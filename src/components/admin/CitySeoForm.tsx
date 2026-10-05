"use client";

import { useState, useMemo } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Wand2, Save, X, ExternalLink, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateCitySeo } from "@/ai/flows/generateCitySeoFlow";
import type { FirestoreCity } from "@/types/firestore";

const citySeoFormSchema = z.object({
  id: z.string(),
  name: z.string(),
  h1_title: z.string().optional(),
  seo_title: z.string().max(100, "Title is a bit long").optional(),
  seo_description: z.string().max(300, "Description is too long").optional(),
  seo_keywords: z.string().optional(),
  isActive: z.boolean().default(true),
});

type CitySeoFormData = z.infer<typeof citySeoFormSchema>;

interface CitySeoFormProps {
  initialData?: FirestoreCity | null;
  onSubmit: (data: CitySeoFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export default function CitySeoForm({ initialData, onSubmit, onCancel, isSubmitting }: CitySeoFormProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const form = useForm<CitySeoFormData>({
    resolver: zodResolver(citySeoFormSchema),
    defaultValues: {
      id: initialData?.id || "new",
      name: initialData?.name || "",
      h1_title: initialData?.h1_title || "",
      seo_title: initialData?.seo_title || initialData?.metaTitle || "",
      seo_description: initialData?.seo_description || initialData?.metaDescription || "",
      seo_keywords: initialData?.seo_keywords || initialData?.metaKeywords || "",
      isActive: initialData?.isActive ?? true,
    },
  });

  const watchedName = form.watch("name");

  const activeSlug = useMemo(() => {
    return initialData?.slug || (watchedName ? watchedName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : "");
  }, [watchedName, initialData]);

  const handleGenerateAI = async () => {
    if (!watchedName) {
      toast({ title: "Name Required", description: "Please enter the city name first.", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    try {
      const result = await generateCitySeo({ cityName: watchedName });
      form.setValue("h1_title", result.h1_title, { shouldValidate: true });
      form.setValue("seo_title", result.seo_title, { shouldValidate: true });
      form.setValue("seo_description", result.seo_description, { shouldValidate: true });
      form.setValue("seo_keywords", result.seo_keywords, { shouldValidate: true });
      toast({ title: "AI Generated!", description: "SEO fields populated for " + watchedName });
    } catch (error) {
      toast({ title: "AI Error", description: "Failed to generate SEO content.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">{initialData ? `City: ${initialData.name}` : 'Add New City'}</h3>
            <Button type="button" variant="outline" size="sm" onClick={handleGenerateAI} disabled={isGenerating || isSubmitting || !watchedName}>
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                Generate with AI
            </Button>
        </div>

        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>City Name</FormLabel>
            <div className="flex gap-2">
              <FormControl>
                <Input placeholder="e.g., Bangalore" {...field} disabled={isSubmitting || !!initialData} className="flex-grow font-mono text-sm" />
              </FormControl>
              {activeSlug && (
                <div className="flex gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      window.open(`/${activeSlug}`, '_blank');
                    }}
                    title="Open page in new tab"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/${activeSlug}`);
                      toast({ title: "Copied", description: "URL copied to clipboard." });
                    }}
                    title="Copy full URL"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            {activeSlug && (
              <FormDescription>
                Active URL: <span className="font-mono font-bold text-foreground">/{activeSlug}</span>
              </FormDescription>
            )}
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="h1_title" render={({ field }) => (
          <FormItem>
            <FormLabel>H1 Title</FormLabel>
            <FormControl><Input placeholder="e.g., Best Professional Artists in Bangalore" {...field} value={field.value || ""} disabled={isSubmitting}/></FormControl>
            <FormDescription>The main title shown on the city homepage.</FormDescription>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="seo_title" render={({ field }) => (
          <FormItem>
            <FormLabel>Meta Title</FormLabel>
            <FormControl><Input placeholder="SEO Optimized Title" {...field} value={field.value || ""} disabled={isSubmitting}/></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="seo_description" render={({ field }) => (
          <FormItem>
            <FormLabel>Meta Description</FormLabel>
            <FormControl><Textarea placeholder="Compelling summary for search results..." {...field} value={field.value || ""} disabled={isSubmitting} rows={3}/></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="seo_keywords" render={({ field }) => (
          <FormItem>
            <FormLabel>Meta Keywords</FormLabel>
            <FormControl><Input placeholder="keyword1, keyword2, city name..." {...field} value={field.value || ""} disabled={isSubmitting}/></FormControl>
            <FormDescription>Comma-separated keywords.</FormDescription>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="isActive" render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <FormLabel className="text-base">Active Homepage</FormLabel>
              <FormDescription>Enable or disable the city-specific homepage.</FormDescription>
            </div>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting}/>
            </FormControl>
          </FormItem>
        )} />

        <div className="flex justify-end gap-3 pt-6 border-t mt-6">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}><X className="mr-2 h-4 w-4" />Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save City SEO Settings
          </Button>
        </div>
      </form>
    </Form>
  );
}
