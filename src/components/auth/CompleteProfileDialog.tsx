"use client";

import { useEffect, useState } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { User as FirebaseUser } from 'firebase/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Loader2, User, Mail, Phone, ShieldCheck, Check } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import CountryPhoneInput from '@/components/ui/CountryPhoneInput';
import {
  Country,
  DEFAULT_COUNTRY,
  findCountryFromPhoneNumber,
  validatePhoneNumber,
  cleanPhoneDigits,
} from '@/lib/countryPhoneData';

interface CompleteProfileDialogProps {
  isOpen: boolean;
  user: FirebaseUser;
  onSubmit: (details: { fullName: string; email?: string; mobileNumber?: string }) => Promise<void>;
  onClose: () => void;
}

const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters."),
  mobileNumber: z.string().optional(),
  email: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function CompleteProfileDialog({
  isOpen,
  user,
  onSubmit,
  onClose
}: CompleteProfileDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const providerId = user.providerData[0]?.providerId;
  const isPhoneSignIn = providerId === 'phone' || !!user.phoneNumber || user.providerData.some(p => p.providerId === 'phone');
  const isGoogleSignIn = providerId === 'google.com' || user.providerData.some(p => p.providerId === 'google.com');

  const initialPhoneParse = findCountryFromPhoneNumber(user.phoneNumber || '');
  const [selectedCountry, setSelectedCountry] = useState<Country>(initialPhoneParse.country || DEFAULT_COUNTRY);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user.displayName || "",
      email: user.email || "",
      mobileNumber: initialPhoneParse.nationalNumber || "",
    },
  });

  useEffect(() => {
    const parsed = findCountryFromPhoneNumber(user.phoneNumber || '');
    if (parsed.country) {
      setSelectedCountry(parsed.country);
    }
    form.reset({
      fullName: user.displayName || "",
      email: user.email || "",
      mobileNumber: parsed.nationalNumber || "",
    });
  }, [user, form]);

  const handleSubmit = async (data: ProfileFormData) => {
    // 1. Validate full name
    const trimmedName = data.fullName.trim();
    if (trimmedName.length < 2) {
      form.setError("fullName", { type: "manual", message: "Full name must be at least 2 characters." });
      return;
    }

    // 2. Validate email
    const emailForSubmit = (data.email || user.email || "").trim();
    if (!emailForSubmit || !z.string().email().safeParse(emailForSubmit).success) {
      form.setError("email", { type: "manual", message: "A valid email address is required." });
      return;
    }

    // 3. Validate mobile number with dynamic country restrictions
    let mobileNumberForSubmit = data.mobileNumber?.trim() || "";
    if (!isPhoneSignIn) {
      const validation = validatePhoneNumber(mobileNumberForSubmit, selectedCountry);
      if (!validation.isValid) {
        form.setError("mobileNumber", { 
          type: "manual", 
          message: validation.message || "Please enter a valid mobile number." 
        });
        return;
      }
      mobileNumberForSubmit = `${selectedCountry.calling_code}${mobileNumberForSubmit}`;
    } else {
      mobileNumberForSubmit = user.phoneNumber || mobileNumberForSubmit;
    }
    
    setIsSubmitting(true);
    try {
      await onSubmit({
        fullName: trimmedName,
        email: emailForSubmit,
        mobileNumber: mobileNumberForSubmit,
      });
    } catch (error: any) {
      const errorMessage = error.message || "Could not save profile. Please try again.";
      toast({ title: "Registration Update", description: errorMessage, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent 
        className="max-w-[92vw] sm:max-w-md max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
            e.preventDefault();
            onClose(); 
        }}
        hideCloseButton={true}
      >
        <DialogHeader className="text-center sm:text-left">
          <div className="mx-auto sm:mx-0 w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center mb-2 text-primary">
            <User className="w-5 h-5" />
          </div>
          <DialogTitle className="text-xl font-bold">Complete Your Profile</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
            Welcome! Please confirm your details and enter your mobile number to complete your account setup.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-1">
            {/* Full Name Field */}
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center text-sm font-medium">
                    <User className="mr-2 h-4 w-4 text-primary" />
                    Full Name <span className="text-destructive ml-0.5">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Your full name" 
                      {...field} 
                      disabled={isSubmitting} 
                    />
                  </FormControl>
                  <FormDescription className="text-[11px] text-muted-foreground">
                    Taken by default from your account, but you can change it.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email Address Field */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="flex items-center text-sm font-medium">
                      <Mail className="mr-2 h-4 w-4 text-primary" />
                      Email Address <span className="text-destructive ml-0.5">*</span>
                    </FormLabel>
                    {isGoogleSignIn && (
                      <span className="text-[11px] font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3 text-green-600 dark:text-green-400" />
                        Google Account
                      </span>
                    )}
                  </div>
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="Your email address" 
                      {...field} 
                      disabled={isSubmitting || (isGoogleSignIn && !!user.email)} 
                      className={isGoogleSignIn && !!user.email ? "bg-muted text-muted-foreground cursor-not-allowed select-none" : ""}
                    />
                  </FormControl>
                  <FormDescription className="text-[11px] text-muted-foreground">
                    {isGoogleSignIn && !!user.email 
                      ? "Taken automatically from your Google account." 
                      : "We will use this email for account updates."}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Mobile Number Field with Country Selector & Dynamic Restriction */}
            <FormField
              control={form.control}
              name="mobileNumber"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="flex items-center text-sm font-medium">
                      <Phone className="mr-2 h-4 w-4 text-primary" />
                      Mobile Number <span className="text-destructive ml-0.5">*</span>
                    </FormLabel>
                    {isPhoneSignIn && (
                      <span className="text-[11px] font-normal text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        Verified Phone
                      </span>
                    )}
                  </div>
                  <FormControl>
                    <CountryPhoneInput
                      value={field.value || ""}
                      selectedCountry={selectedCountry}
                      onCountryChange={(newCountry) => {
                        setSelectedCountry(newCountry);
                        const truncated = cleanPhoneDigits(field.value || "", newCountry.maxLength);
                        field.onChange(truncated);
                      }}
                      onChange={(digits) => {
                        field.onChange(digits);
                      }}
                      disabled={isSubmitting || isPhoneSignIn}
                      error={form.formState.errors.mobileNumber?.message}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter className="flex flex-row justify-end gap-2 pt-3 sm:gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose} 
                disabled={isSubmitting}
                className="flex-1 sm:flex-none"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="flex-1 sm:flex-none"
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Complete Registration
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
