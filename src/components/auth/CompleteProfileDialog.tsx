
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import type { User as FirebaseUser } from 'firebase/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, User, Mail, Phone, Gift, AtSign, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import { useAuth } from '@/hooks/useAuth';
import { debounce } from 'lodash';
import { Badge } from '@/components/ui/badge';

interface CompleteProfileDialogProps {
  isOpen: boolean;
  user: FirebaseUser;
  onSubmit: (details: { fullName: string; username: string; email?: string; mobileNumber?: string; referralCode?: string }) => Promise<void>;
  onClose: () => void; // For cancelling/logging out the partial user
}

const profileSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters."),
  username: z.string()
    .min(3, { message: "Username must be at least 3 characters." })
    .max(20, { message: "Username cannot exceed 20 characters." })
    .regex(/^[a-zA-Z0-9_]+$/, { message: "Username can only contain letters, numbers, and underscores." }),
  mobileNumber: z.string().optional(),
  email: z.string().optional(),
  referralCode: z.string().optional(),
}).superRefine((data, ctx) => {
  // Logic handled in handleSubmit for specific Artist requirements
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
  const { config, isLoading: isLoadingConfig } = useApplicationConfig();
  const { checkUsernameAvailability, generateUsernameSuggestions } = useAuth();
  
  const providerId = user.providerData[0]?.providerId;
  const isPhoneSignIn = providerId === 'phone' || !!user.phoneNumber || user.providerData.some(p => p.providerId === 'phone');
  const isGoogleSignIn = providerId === 'google.com' || user.providerData.some(p => p.providerId === 'google.com');

  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isUsernameManuallyEdited, setIsUsernameManuallyEdited] = useState(false);

  const cleanPhoneNumber = useCallback((value: string, countryCode: string = "+91") => {
    let cleaned = value.trim().replace(/\s+/g, '');
    
    // Case 1: Starts with + (autofill, contact selection, copy-paste format)
    if (cleaned.startsWith('+')) {
      if (cleaned.startsWith(countryCode)) {
        cleaned = cleaned.substring(countryCode.length);
      } else {
        cleaned = cleaned.replace(/^\+\d+/, '');
      }
    } 
    // Case 2: Leading 0 format (starts with 0 and has more than 10 digits)
    else if (cleaned.startsWith('0') && cleaned.length > 10) {
      cleaned = cleaned.substring(1);
    }
    
    // For manual typing (e.g. 91xxxxxxxxxx without + or 0), we do NOT automatically strip 91.
    // If there is an 11-digit typo, it is preserved so they see the error and correct it.
    return cleaned.replace(/\D/g, '');
  }, []);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user.displayName || "",
      username: (user.displayName || "").toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, ''),
      email: user.email || "",
      mobileNumber: user.phoneNumber ? cleanPhoneNumber(user.phoneNumber, config.defaultOtpCountryCode || '+91') : "",
      referralCode: "",
    },
  });

  const fullName = form.watch("fullName");
  const username = form.watch("username");

  // Debounced availability check
  const debouncedCheck = useCallback(
    debounce(async (val: string) => {
      if (val.length < 3) {
        setUsernameStatus('invalid');
        return;
      }
      setUsernameStatus('checking');
      const isAvailable = await checkUsernameAvailability(val, user.uid);
      if (isAvailable) {
        setUsernameStatus('available');
        setSuggestions([]);
      } else {
        setUsernameStatus('taken');
        const newSuggestions = await generateUsernameSuggestions(val);
        setSuggestions(newSuggestions);
      }
    }, 500),
    [checkUsernameAvailability, generateUsernameSuggestions, user.uid]
  );

  useEffect(() => {
    if (username) {
      debouncedCheck(username);
    } else {
      setUsernameStatus('idle');
      setSuggestions([]);
    }
  }, [username, debouncedCheck]);

  // Auto-generate username from fullName
  useEffect(() => {
    if (fullName && !isUsernameManuallyEdited) {
      const generated = fullName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
      if (generated) {
        form.setValue("username", generated, { shouldValidate: true });
      }
    }
  }, [fullName, isUsernameManuallyEdited, form]);

  useEffect(() => {
    // Reset form when initial data or config changes
    form.reset({
      fullName: user.displayName || "",
      username: (user.displayName || "").toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, ''),
      email: user.email || "",
      mobileNumber: user.phoneNumber ? cleanPhoneNumber(user.phoneNumber, config.defaultOtpCountryCode || '+91') : "",
      referralCode: "",
    });
  }, [user, config, form, cleanPhoneNumber]);

  const handleSubmit = async (data: ProfileFormData) => {
    if (usernameStatus !== 'available') {
      form.setError("username", { message: "Please choose an available username." });
      return;
    }

    let mobileNumberForSubmit = data.mobileNumber;

    if (isGoogleSignIn || providerId === 'password') {
      if (!data.mobileNumber || !/^\d{10}$/.test(data.mobileNumber)) {
        form.setError("mobileNumber", { type: "manual", message: "A valid 10-digit mobile number is required." });
        return;
      }
      mobileNumberForSubmit = `${config.defaultOtpCountryCode || '+91'}${data.mobileNumber}`;
    }

    if (isPhoneSignIn && (!data.email || !z.string().email().safeParse(data.email).success)) {
      form.setError("email", { type: "manual", message: "A valid email address is required." });
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onSubmit({
        fullName: data.fullName,
        username: data.username,
        email: data.email || user.email || undefined,
        mobileNumber: mobileNumberForSubmit || user.phoneNumber || undefined,
        referralCode: data.referralCode,
      });
    } catch (error: any) {
      const errorMessage = error.message || "Could not save profile. Please try again.";
      toast({ title: "Registration Update", description: errorMessage, variant: errorMessage.includes('referral') ? "warning" : "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasAutoReferral = typeof window !== 'undefined' && !!localStorage.getItem('referralCode');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent 
        className="max-w-[90%] sm:max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
            e.preventDefault();
            onClose(); 
        }}
        hideCloseButton={true}
      >
        <DialogHeader>
          <DialogTitle className="text-xl">Complete Your Profile</DialogTitle>
          <DialogDescription>
            Welcome! We just need a few more details to create your account.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><User className="mr-2 h-4 w-4" />Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Your full name" {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField 
              control={form.control} 
              name="username" 
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center"><AtSign className="mr-2 h-4 w-4" />Username</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        placeholder="johndoe123" 
                        {...field} 
                        disabled={isSubmitting}
                        onChange={(e) => {
                          field.onChange(e);
                          setIsUsernameManuallyEdited(true);
                        }}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {usernameStatus === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                        {usernameStatus === 'available' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        {usernameStatus === 'taken' && <XCircle className="h-4 w-4 text-destructive" />}
                      </div>
                    </div>
                  </FormControl>
                  {usernameStatus === 'taken' && suggestions.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-muted-foreground">Username taken. Suggestions:</p>
                      <div className="flex flex-wrap gap-2">
                        {suggestions.map((sug) => (
                          <Badge 
                            key={sug} 
                            variant="outline" 
                            className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                            onClick={() => {
                              form.setValue("username", sug, { shouldValidate: true });
                              setUsernameStatus('available');
                            }}
                          >
                            {sug}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isPhoneSignIn && (
              <FormField
                control={form.control}
                name="mobileNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><Phone className="mr-2 h-4 w-4" />Mobile Number</FormLabel>
                     <div className="flex items-center">
                        <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground h-10">
                          {isLoadingConfig ? '...' : config.defaultOtpCountryCode}
                        </span>
                        <FormControl>
                          <Input
                            type="tel"
                            placeholder="10-digit number"
                            {...field}
                            onChange={(e) => {
                              const cleaned = cleanPhoneNumber(e.target.value, config.defaultOtpCountryCode || '+91');
                              field.onChange(cleaned);
                            }}
                            className="rounded-l-none"
                            disabled={isSubmitting || isLoadingConfig}
                          />
                        </FormControl>
                      </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
             
            {isPhoneSignIn && (
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center"><Mail className="mr-2 h-4 w-4" />Email Address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Your email address" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {!hasAutoReferral && (
              <FormField
                control={form.control}
                name="referralCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center text-primary/80"><Gift className="mr-2 h-4 w-4" />Referral Code (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter referral code" {...field} disabled={isSubmitting} className="uppercase font-mono" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button type="submit" disabled={isSubmitting || isLoadingConfig || usernameStatus === 'checking'}>
                    {(isSubmitting || isLoadingConfig) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Account
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

