"use client";

import { useState, useMemo } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, X, ExternalLink, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { FirestoreCity, FirestoreArea } from "@/types/firestore";

const areaFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Area Name is required"),
  cityId: z.string().min(1, "Parent City is required"),
  slug: z.string().optional(),
  isActive: z.boolean().default(true),
});

type AreaFormData = z.infer<typeof areaFormSchema>;

interface AreaFormProps {
  initialData?: FirestoreArea | null;
  cities: FirestoreCity[];
  onSubmit: (data: AreaFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export default function AreaForm({ initialData, cities, onSubmit, onCancel, isSubmitting }: AreaFormProps) {
  const form = useForm<AreaFormData>({
    resolver: zodResolver(areaFormSchema),
    defaultValues: {
      id: initialData?.id || "",
      name: initialData?.name || "",
      cityId: initialData?.cityId || "",
      slug: initialData?.slug || "",
      isActive: initialData?.isActive ?? true,
    },
  });

  const { toast } = useToast();
  const watchedCityId = form.watch("cityId");
  const watchedName = form.watch("name");
  const watchedSlug = form.watch("slug");

  const city = useMemo(() => cities.find(c => c.id === watchedCityId), [cities, watchedCityId]);

  const activeSlug = useMemo(() => {
    const nameSlug = watchedName ? watchedName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : "";
    const segment = watchedSlug || nameSlug;
    if (city && segment) {
      return `${city.slug}/${segment}`;
    }
    return "";
  }, [watchedSlug, watchedName, city]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex items-center justify-between mb-4 pb-2 border-b">
          <h3 className="font-bold text-lg">{initialData ? `Edit Area: ${initialData.name}` : 'Add New Locality / Area'}</h3>
        </div>

        <FormField control={form.control} name="cityId" render={({ field }) => (
          <FormItem>
            <FormLabel>Parent City <span className="text-destructive">*</span></FormLabel>
            <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting || !!initialData}>
              <FormControl><SelectTrigger><SelectValue placeholder="Choose City" /></SelectTrigger></FormControl>
              <SelectContent>
                {cities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <FormDescription>Select the city this locality belongs to.</FormDescription>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Area Name <span className="text-destructive">*</span></FormLabel>
            <FormControl><Input placeholder="e.g., Whitefield" {...field} disabled={isSubmitting}/></FormControl>
            <FormDescription>The name of the neighborhood or area.</FormDescription>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="slug" render={({ field }) => (
          <FormItem>
            <FormLabel>Slug (Optional)</FormLabel>
            <div className="flex gap-2">
              <FormControl>
                <Input 
                  placeholder="e.g., whitefield" 
                  {...field} 
                  value={field.value || ""} 
                  disabled={isSubmitting}
                  className="flex-grow font-mono text-sm"
                />
              </FormControl>
              {activeSlug && (
                <div className="flex gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      window.open(activeSlug.startsWith('/') ? activeSlug : `/${activeSlug}`, '_blank');
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
                      const path = activeSlug.startsWith('/') ? activeSlug : `/${activeSlug}`;
                      navigator.clipboard.writeText(`${window.location.origin}${path}`);
                      toast({ title: "Copied", description: "URL copied to clipboard." });
                    }}
                    title="Copy full URL"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <FormDescription>
              {activeSlug ? (
                <span>Active URL: <span className="font-mono font-bold text-foreground">/{activeSlug.startsWith('/') ? activeSlug.slice(1) : activeSlug}</span></span>
              ) : (
                "The URL path segment. Will auto-generate from name if left empty."
              )}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="isActive" render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <FormLabel className="text-base">Active Locality</FormLabel>
              <FormDescription>Enable or disable this locality/area on search registers.</FormDescription>
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
            Save Locality
          </Button>
        </div>
      </form>
    </Form>
  );
}
