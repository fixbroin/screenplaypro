
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Sparkles, Wand2, Users, Layers } from 'lucide-react';
import type { FirestoreCategory, FirestoreReview } from '@/types/firestore';
import { useToast } from '@/hooks/use-toast';
import { generateBulkReviews } from '@/ai/flows/generateBulkReviewsFlow';
import { db } from '@/lib/firebase';
import { collection, writeBatch, Timestamp, doc } from 'firebase/firestore';

const formSchema = z.object({
  targetType: z.enum(['artist', 'category']),
  targetId: z.string({ required_error: "Please select an artist or category." }),
  numberOfReviews: z.coerce.number().int().min(1, "Must generate at least 1 review.").max(20, "Cannot generate more than 20 reviews at once."),
});

type BulkReviewFormData = z.infer<typeof formSchema>;

interface BulkReviewGeneratorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerationComplete: () => void;
  artists: { id: string; name: string; categoryId: string }[];
  categories: Pick<FirestoreCategory, 'id' | 'name'>[];
}

export default function BulkReviewGeneratorDialog({
  isOpen,
  onClose,
  onGenerationComplete,
  artists,
  categories,
}: BulkReviewGeneratorDialogProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'artist' | 'category'>('artist');

  const form = useForm<BulkReviewFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { targetType: 'artist', targetId: undefined, numberOfReviews: 5 },
  });

  const onSubmit = async (data: BulkReviewFormData) => {
    setIsGenerating(true);
    toast({ title: "Starting Review Generation...", description: "The AI is crafting reviews. This may take a moment." });

    let targetName = "";
    let categoryName = "";
    let artistId = "";

    if (data.targetType === 'artist') {
      const artist = artists.find(a => a.id === data.targetId);
      if (!artist) {
        toast({ title: "Error", description: "Selected artist not found.", variant: "destructive" });
        setIsGenerating(false);
        return;
      }
      targetName = artist.name;
      artistId = artist.id;
      const cat = categories.find(c => c.id === artist.categoryId);
      categoryName = cat?.name || "Artist";
    } else {
      const category = categories.find(c => c.id === data.targetId);
      if (!category) {
        toast({ title: "Error", description: "Selected category not found.", variant: "destructive" });
        setIsGenerating(false);
        return;
      }
      targetName = category.name;
      categoryName = category.name;
      artistId = `category_${category.id}`; // Placeholder for serviceId
    }

    try {
      const aiResult = await generateBulkReviews({
        serviceId: artistId,
        serviceName: targetName,
        subCategoryName: "", // Not used in artist flow
        categoryName: categoryName,
        numberOfReviews: data.numberOfReviews,
      });

      if (!aiResult.reviews || aiResult.reviews.length === 0) {
        throw new Error("AI did not return any reviews.");
      }
      
      toast({ title: "AI Generation Complete", description: `Saving ${aiResult.reviews.length} new reviews to the database.` });

      // Save to Firestore
      const batch = writeBatch(db);
      const reviewsCollectionRef = collection(db, "adminReviews");

      aiResult.reviews.forEach(review => {
        const newReviewRef = doc(reviewsCollectionRef);
        const reviewData: Omit<FirestoreReview, 'id'> = {
          serviceId: artistId,
          serviceName: targetName,
          userName: review.userName,
          rating: review.rating,
          comment: review.comment,
          status: "Approved", // Auto-approve AI-generated reviews
          adminCreated: true,
          createdAt: Timestamp.now(),
        };
        batch.set(newReviewRef, reviewData);
      });

      await batch.commit();

      toast({ title: "Success!", description: `${aiResult.reviews.length} reviews have been successfully generated and saved.`, className: "bg-green-100 text-green-700 border-green-300" });
      onGenerationComplete(); 
      onClose(); 

    } catch (error) {
      console.error("Error generating or saving bulk reviews:", error);
      toast({ title: "Error", description: (error as Error).message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {if (!isGenerating) onClose()}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center"><Wand2 className="mr-2 h-5 w-5 text-primary"/> AI Bulk Review Generator</DialogTitle>
          <DialogDescription>
            Generate realistic reviews for an artist or an entire category.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="artist" onValueChange={(val) => {
          const type = val as 'artist' | 'category';
          setActiveTab(type);
          form.setValue('targetType', type);
          form.setValue('targetId', '');
        }}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="artist"><Users className="mr-2 h-4 w-4"/> Artist</TabsTrigger>
            <TabsTrigger value="category"><Layers className="mr-2 h-4 w-4"/> Category</TabsTrigger>
          </TabsList>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="targetId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{activeTab === 'artist' ? 'Select Artist' : 'Select Category'}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isGenerating}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={activeTab === 'artist' ? "Choose an artist..." : "Choose a category..."} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {activeTab === 'artist' ? (
                          artists.map(artist => (
                            <SelectItem key={artist.id} value={artist.id}>{artist.name}</SelectItem>
                          ))
                        ) : (
                          categories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="numberOfReviews"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Reviews to Generate</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" max="20" placeholder="e.g., 10" {...field} disabled={isGenerating} />
                    </FormControl>
                    <FormDescription>Max 20 reviews per generation.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={onClose} disabled={isGenerating}>Cancel</Button>
                <Button type="submit" disabled={isGenerating}>
                  {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Generate Reviews
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
