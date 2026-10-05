"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateBulkReviews } from '@/ai/flows/generateBulkReviewsFlow';

const formSchema = z.object({
  topic: z.string().optional(),
  numberOfReviews: z.coerce.number().int().min(1, "Must generate at least 1 review.").max(20, "Cannot generate more than 20 reviews at once.").default(5),
});

type BulkReviewFormData = z.infer<typeof formSchema>;

interface BulkReviewGeneratorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerationComplete: () => void;
  artists?: { id: string; name: string; categoryId: string }[];
  categories?: any[];
}

export default function BulkReviewGeneratorDialog({
  isOpen,
  onClose,
  onGenerationComplete,
}: BulkReviewGeneratorDialogProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const form = useForm<BulkReviewFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { topic: "", numberOfReviews: 5 },
  });

  const onSubmit = async (data: BulkReviewFormData) => {
    setIsGenerating(true);
    toast({ title: "Starting Review Generation...", description: "AI is creating real reviews with authentic names for Screenplay Pro." });

    try {
      const aiResult = await generateBulkReviews({
        topic: data.topic || "Screenplay & Script Writing",
        numberOfReviews: data.numberOfReviews,
      });

      if (!aiResult.reviews || aiResult.reviews.length === 0) {
        throw new Error("AI did not return any reviews.");
      }
      
      toast({ title: "AI Generation Complete", description: `Saving ${aiResult.reviews.length} new reviews to database.` });

      await Promise.all(
        aiResult.reviews.map(review => {
          const docId = `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const reviewData = {
            id: docId,
            serviceId: "screenplay_pro",
            serviceName: review.serviceName || "Screenplay Pro",
            userName: review.userName,
            rating: review.rating,
            comment: review.comment,
            status: "Approved", // Auto-approve AI-generated reviews
            adminCreated: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          return fetch('/api/db/collections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ collectionName: 'adminReviews', id: docId, data: reviewData })
          });
        })
      );

      toast({ 
        title: "Success!", 
        description: `${aiResult.reviews.length} reviews have been generated with real names and saved successfully.`,
        className: "bg-green-100 text-green-700 border-green-300"
      });
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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!isGenerating) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center"><Wand2 className="mr-2 h-5 w-5 text-primary"/> AI Bulk Review Generator</DialogTitle>
          <DialogDescription>
            Directly generate realistic screenplay writing reviews with real user names.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <FormField
              control={form.control}
              name="topic"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Script Topic / Genre (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Feature Film, Sci-Fi Pilot, Dialogue, Formatting..." {...field} disabled={isGenerating} />
                  </FormControl>
                  <FormDescription>Leave empty for diverse screenplay reviews.</FormDescription>
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
                    <Input type="number" min="1" max="20" placeholder="e.g., 5" {...field} disabled={isGenerating} />
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
      </DialogContent>
    </Dialog>
  );
}
