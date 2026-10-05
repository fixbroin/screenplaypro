"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star, Loader2 } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import type { FirestoreBooking, FirestoreReview, FirestoreService } from '@/types/firestore';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const reviewSchema = z.object({
  rating: z.number().min(1, "Rating is required.").max(5, "Rating cannot exceed 5."),
  comment: z.string().min(10, "Comment must be at least 10 characters.").max(1000, "Comment cannot exceed 1000 characters."),
});

type ReviewFormData = z.infer<typeof reviewSchema>;

interface ReviewSubmissionModalProps {
  booking: FirestoreBooking;
  isOpen: boolean;
  onReviewSubmitted: () => void;
}

export default function ReviewSubmissionModal({ booking, isOpen, onReviewSubmitted }: ReviewSubmissionModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [serviceToReview, setServiceToReview] = useState<FirestoreService | null>(null);
  const [isLoadingService, setIsLoadingService] = useState(true);

  const form = useForm<ReviewFormData>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: 0,
      comment: "",
    },
  });

  useEffect(() => {
    const fetchServiceDetails = async () => {
      if (isOpen && booking.services.length > 0) {
        setIsLoadingService(true);
        const firstServiceId = booking.services[0].serviceId;
        try {
          const res = await fetch(`/api/db/collections?name=adminServices&id=${firstServiceId}`);
          const data = await res.json();
          if (data.success && data.data) {
            setServiceToReview({ id: firstServiceId, ...data.data } as FirestoreService);
          } else {
            console.warn(`Service with ID ${firstServiceId} not found for review.`);
            onReviewSubmitted();
          }
        } catch (error) {
          console.error("Error fetching service for review:", error);
          onReviewSubmitted();
        } finally {
          setIsLoadingService(false);
        }
      } else if (!isOpen) {
        setServiceToReview(null);
        setIsLoadingService(false);
      }
    };

    fetchServiceDetails();
    if (isOpen) {
      form.reset({ rating: 0, comment: "" });
    }
  }, [booking, isOpen, form, onReviewSubmitted]);

  const onSubmit = async (data: ReviewFormData) => {
    if (!user || !serviceToReview || !booking.id) {
      toast({ title: "Error", description: "User, service, or booking information missing.", variant: "destructive" });
      return;
    }
    setIsSubmittingReview(true);
    try {
      const reviewData = {
        serviceId: serviceToReview.id,
        serviceName: serviceToReview.name,
        bookingId: booking.bookingId,
        userId: user.uid,
        userName: user.displayName || "Anonymous User",
        userAvatarUrl: user.photoURL || undefined,
        rating: data.rating,
        comment: data.comment,
        status: "Approved",
        adminCreated: false,
        createdAt: new Date().toISOString(),
      };

      await fetch('/api/db/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectionName: 'adminReviews',
          data: reviewData
        })
      });

      await fetch('/api/db/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectionName: 'bookings',
          id: booking.id,
          data: { ...booking, isReviewedByCustomer: true, updatedAt: new Date().toISOString() }
        })
      });

      toast({ title: "Review Submitted", description: "Thank you for your feedback!" });
      onReviewSubmitted(); 
    } catch (error) {
      console.error("Error submitting review:", error);
      toast({ title: "Error", description: "Failed to submit review. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onReviewSubmitted(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rate Your Experience</DialogTitle>
          <DialogDescription>
            {isLoadingService ? "Loading service details..." : `How was your experience with ${serviceToReview?.name || 'this service'}?`}
          </DialogDescription>
        </DialogHeader>

        {isLoadingService ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="rating"
                render={({ field }) => (
                  <FormItem className="flex flex-col items-center">
                    <FormLabel className="text-center mb-2 font-bold">Overall Rating</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            type="button"
                            key={star}
                            onClick={() => field.onChange(star)}
                            className="p-1 focus:outline-none transition-transform hover:scale-110"
                          >
                            <Star
                              className={`h-8 w-8 ${
                                star <= field.value
                                  ? 'text-yellow-400 fill-yellow-400'
                                  : 'text-muted-foreground/30'
                              }`}
                            />
                          </button>
                        ))}
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
                    <FormLabel>Your Review</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Tell us what you liked or what could be improved..."
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={onReviewSubmitted} disabled={isSubmittingReview}>
                  Skip for Now
                </Button>
                <Button type="submit" disabled={isSubmittingReview || form.watch('rating') === 0}>
                  {isSubmittingReview && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Review
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
