"use client";

import { useState, useMemo, useRef, useEffect } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Wand2, Save, X, Check, ChevronsUpDown, Search, AlertCircle, ExternalLink, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generateCityCategorySeo } from "@/ai/flows/generateCityCategorySeoFlow";
import type { FirestoreCity, FirestoreCategory, CityCategorySeoSetting } from "@/types/firestore";

interface SearchableSelectProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  disabled?: boolean;
}

function SearchableSelect({ options, value, onChange, placeholder, searchPlaceholder = "Search...", disabled }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex h-9 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground cursor-pointer"
                >
                  <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    {value === opt.value && <Check className="h-4 w-4" />}
                  </span>
                  <span className="truncate">{opt.label}</span>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-sm text-muted-foreground">No options found.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const cityCategorySeoFormSchema = z.object({
  id: z.string().optional(),
  cityId: z.string().min(1, "City is required"),
  categoryId: z.string().min(1, "Category is required"),
  h1_title: z.string().optional(),
  meta_title: z.string().max(100, "Title is a bit long").optional(),
  meta_description: z.string().max(300, "Description is too long").optional(),
  meta_keywords: z.string().optional(),
  imageHint: z.string().optional(),
  slug: z.string().optional(),
  isActive: z.boolean().default(true),
});

type CityCategorySeoFormData = z.infer<typeof cityCategorySeoFormSchema>;

interface CityCategorySeoFormProps {
  initialData?: CityCategorySeoSetting | null;
  cities: FirestoreCity[];
  categories: FirestoreCategory[];
  existingOverrides: CityCategorySeoSetting[];
  onSubmit: (data: CityCategorySeoFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export default function CityCategorySeoForm({ initialData, cities, categories, existingOverrides, onSubmit, onCancel, isSubmitting }: CityCategorySeoFormProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const form = useForm<CityCategorySeoFormData>({
    resolver: zodResolver(cityCategorySeoFormSchema),
    defaultValues: {
      id: initialData?.id || "",
      cityId: initialData?.cityId || "",
      categoryId: initialData?.categoryId || "",
      h1_title: initialData?.h1_title || "",
      meta_title: initialData?.meta_title || "",
      meta_description: initialData?.meta_description || "",
      meta_keywords: initialData?.meta_keywords || "",
      imageHint: initialData?.imageHint || "",
      slug: initialData?.slug || "",
      isActive: initialData?.isActive ?? true,
    },
  });

  const watchedCityId = form.watch("cityId");
  const watchedCategoryId = form.watch("categoryId");
  const watchedSlug = form.watch("slug");

  const city = useMemo(() => cities.find(c => c.id === watchedCityId), [cities, watchedCityId]);
  const category = useMemo(() => categories.find(c => c.id === watchedCategoryId), [categories, watchedCategoryId]);

  const activeSlug = useMemo(() => {
    if (watchedSlug) return watchedSlug;
    if (city && category) {
      return `${city.slug}/category/${category.slug}`;
    }
    return "";
  }, [watchedSlug, city, category]);

  const cityOptions = useMemo(() => cities.map(c => ({ value: c.id, label: c.name })), [cities]);
  const categoryOptions = useMemo(() => categories.map(c => ({ value: c.id, label: c.name })), [categories]);

  // Check if override combination already exists
  const isAlreadyCreated = useMemo(() => {
    if (initialData) return false; // Skip duplicate checks when editing an existing item
    if (!watchedCityId || !watchedCategoryId) return false;
    return existingOverrides.some(
      o => o.cityId === watchedCityId && o.categoryId === watchedCategoryId
    );
  }, [watchedCityId, watchedCategoryId, existingOverrides, initialData]);

  const handleGenerateAI = async () => {
    const city = cities.find(c => c.id === watchedCityId);
    const category = categories.find(c => c.id === watchedCategoryId);
    
    if (!city || !category) {
      toast({ title: "Selection Required", description: "Please select both a city and a category first.", variant: "destructive" });
      return;
    }
    
    setIsGenerating(true);
    try {
      const result = await generateCityCategorySeo({ cityName: city.name, categoryName: category.name });
      form.setValue("h1_title", result.h1_title, { shouldValidate: true });
      form.setValue("meta_title", result.meta_title, { shouldValidate: true });
      form.setValue("meta_description", result.meta_description, { shouldValidate: true });
      form.setValue("meta_keywords", result.meta_keywords, { shouldValidate: true });
      toast({ title: "AI Generated!", description: `SEO fields populated for ${category.name} in ${city.name}` });
    } catch (error) {
      toast({ title: "AI Error", description: "Failed to generate SEO content.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex items-center justify-between mb-4 pb-2 border-b">
          <h3 className="font-bold text-lg">{initialData ? 'Edit City-Category Settings' : 'Add New City-Category Override'}</h3>
          <Button type="button" variant="outline" size="sm" onClick={handleGenerateAI} disabled={isGenerating || isSubmitting || !watchedCityId || !watchedCategoryId || isAlreadyCreated}>
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            Generate with AI
          </Button>
        </div>

        {isAlreadyCreated && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-xs font-semibold text-destructive animate-pulse">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>SEO override for this City and Category has already been created. Duplicate entries are blocked.</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="cityId" render={({ field }) => (
            <FormItem>
              <FormLabel>Select City <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <SearchableSelect 
                  options={cityOptions} 
                  value={field.value} 
                  onChange={field.onChange} 
                  placeholder="Choose City" 
                  searchPlaceholder="Search cities..."
                  disabled={isSubmitting || !!initialData}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          <FormField control={form.control} name="categoryId" render={({ field }) => (
            <FormItem>
              <FormLabel>Select Category <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <SearchableSelect 
                  options={categoryOptions} 
                  value={field.value} 
                  onChange={field.onChange} 
                  placeholder="Choose Category" 
                  searchPlaceholder="Search categories..."
                  disabled={isSubmitting || !!initialData}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="slug" render={({ field }) => (
          <FormItem>
            <FormLabel>Custom Slug (Optional)</FormLabel>
            <div className="flex gap-2">
              <FormControl>
                <Input 
                  placeholder="e.g., bangalore/male-actor (will autogenerate if empty)" 
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
                "Leave blank to auto-generate slug segments based on URLs."
              )}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="h1_title" render={({ field }) => (
          <FormItem>
            <FormLabel>H1 Title</FormLabel>
            <FormControl><Input placeholder="e.g., Best Professional Male Actors in Bangalore" {...field} value={field.value || ""} disabled={isSubmitting}/></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="meta_title" render={({ field }) => (
          <FormItem>
            <FormLabel>Meta Title</FormLabel>
            <FormControl><Input placeholder="SEO Optimized Title" {...field} value={field.value || ""} disabled={isSubmitting}/></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="meta_description" render={({ field }) => (
          <FormItem>
            <FormLabel>Meta Description</FormLabel>
            <FormControl><Textarea placeholder="Compelling summary for search results..." {...field} value={field.value || ""} disabled={isSubmitting} rows={3}/></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="meta_keywords" render={({ field }) => (
          <FormItem>
            <FormLabel>Meta Keywords</FormLabel>
            <FormControl><Input placeholder="keyword1, keyword2, local search phrases..." {...field} value={field.value || ""} disabled={isSubmitting}/></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="imageHint" render={({ field }) => (
          <FormItem>
            <FormLabel>Image Alt Text Hint (Optional)</FormLabel>
            <FormControl><Input placeholder="e.g., Hire actors in Bangalore, creative crew portfolios..." {...field} value={field.value || ""} disabled={isSubmitting}/></FormControl>
            <FormDescription>Used for dynamically indexing related search images.</FormDescription>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={form.control} name="isActive" render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <FormLabel className="text-base">Active Override</FormLabel>
              <FormDescription>Enable or disable this specific SEO pattern.</FormDescription>
            </div>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting}/>
            </FormControl>
          </FormItem>
        )} />

        <div className="flex justify-end gap-3 pt-6 border-t mt-6">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}><X className="mr-2 h-4 w-4" />Cancel</Button>
          <Button type="submit" disabled={isSubmitting || isAlreadyCreated}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save SEO Settings
          </Button>
        </div>
      </form>
    </Form>
  );
}
