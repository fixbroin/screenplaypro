"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FirestoreReview, ReviewStatus } from "@/types/firestore";
import { useEffect } from "react";
import { Loader2, Star } from "lucide-react";

const reviewStatusOptions: [string, ...string[]] = ["Pending", "Approved", "Rejected", "Flagged"];

const reviewFormSchema = z.object({
  userName: z.string().min(2, "Reviewer name must be at least 2 characters."),
  serviceName: z.string().optional().default("Screenplay Pro"),
  rating: z.coerce.number().min(1, "Rating must be at least 1.").max(5, "Rating cannot exceed 5."),
  comment: z.string().min(5, "Comment must be at least 5 characters.").max(1000, "Comment too long."),
  status: z.enum(reviewStatusOptions),
});

export type ReviewFormData = z.infer<typeof reviewFormSchema>;

interface ReviewFormProps {
  onSubmit: (data: ReviewFormData & { serviceId?: string, adminCreated: boolean, id?: string }) => Promise<void>;
  initialData?: FirestoreReview | null;
  services?: any[];
  onCancel: () => void;
  isSubmitting?: boolean;
}

export default function ReviewForm({ onSubmit: onSubmitProp, initialData, onCancel, isSubmitting = false }: ReviewFormProps) {
  const form = useForm<ReviewFormData>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: {
      userName: initialData?.userName || "Admin",
      serviceName: initialData?.serviceName || "Screenplay Pro",
      rating: initialData?.rating || 5,
      comment: initialData?.comment || "",
      status: initialData?.status || "Approved",
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        userName: initialData.userName || "Admin",
        serviceName: initialData.serviceName || "Screenplay Pro",
        rating: initialData.rating || 5,
        comment: initialData.comment || "",
        status: initialData.status || "Approved",
      });
    } else {
      form.reset({
        userName: "Admin",
        serviceName: "Screenplay Pro",
        rating: 5,
        comment: "",
        status: "Approved",
      });
    }
  }, [initialData, form]);

  const handleSubmit = async (formData: ReviewFormData) => {
    await onSubmitProp({
      ...formData,
      serviceId: "screenplay_pro",
      serviceName: formData.serviceName || "Screenplay Pro",
      adminCreated: true,
      id: initialData?.id
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col h-full space-y-4 p-2">
        <FormField
          control={form.control}
          name="userName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reviewer Name <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Input placeholder="e.g. Ramesh Kumar, Sarah Jenkins" {...field} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="serviceName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Script / Subject Title (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Feature Film Script, Screenplay Pro" {...field} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="rating"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rating (1-5 stars)</FormLabel>
              <FormControl>
                <div className="flex items-center space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-6 w-6 cursor-pointer transition-colors ${
                        star <= field.value ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground hover:text-yellow-300'
                      }`}
                      onClick={() => field.onChange(star)}
                    />
                  ))}
                  <Input type="hidden" {...field} />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="comment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Review Comment <span className="text-destructive">*</span></FormLabel>
              <FormControl>
                <Textarea placeholder="Write the review text here..." {...field} rows={4} disabled={isSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value} disabled={isSubmitting}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {reviewStatusOptions.map(status => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="p-2 border-t bg-background flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {initialData ? 'Save Changes' : 'Create Review'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
