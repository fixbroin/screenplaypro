"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, ShieldCheck, Check, Loader2, FileText, Lock, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { SubscriptionPlan } from '@/types/firestore';
import Script from 'next/script';

const DEFAULT_PLANS_MAP: Record<string, SubscriptionPlan> = {
  plan_monthly: {
    id: 'plan_monthly',
    name: 'Monthly Writer Pass',
    price: 299,
    durationDays: 30,
    isActive: true,
    order: 1,
    features: [
      'Unlimited PDF Script Exports',
      'Studio-Standard Screenplay Formatting',
      'Multi-Language Script Typing',
      'Real-Time Cloud Autosave',
      'Standard Export Quality'
    ]
  },
  plan_annual: {
    id: 'plan_annual',
    name: 'Annual Pro Pass',
    price: 1999,
    durationDays: 365,
    isActive: true,
    order: 2,
    features: [
      'Unlimited PDF Script Exports (Save 45%)',
      'Studio-Standard Screenplay Formatting',
      'Multi-Language Script Typing & AI Translation',
      'Priority High-Speed PDF Rendering',
      'Real-Time Cloud Autosave & Backup',
      'Priority Writer Support'
    ]
  },
  plan_lifetime: {
    id: 'plan_lifetime',
    name: 'Lifetime Writer Pass',
    price: 4999,
    durationDays: 3650,
    isActive: true,
    order: 3,
    features: [
      'Lifetime Unlimited PDF Downloads',
      'All Future AI Script Tools Included',
      'Priority High-Speed Rendering',
      'Multi-Language Translation Engine',
      'VIP Support'
    ]
  }
};

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function SubscriptionPaymentPage() {
  const { user, firestoreUser } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const planId = searchParams.get('planId') || 'plan_monthly';
  const returnUrl = searchParams.get('returnUrl') || '/script-writing';

  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    async function loadPlan() {
      try {
        if (DEFAULT_PLANS_MAP[planId]) {
          setSelectedPlan(DEFAULT_PLANS_MAP[planId]);
        }
        
        const docRef = doc(db, 'adminSubscriptionPlans', planId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setSelectedPlan({ id: docSnap.id, ...docSnap.data() } as SubscriptionPlan);
        } else if (!DEFAULT_PLANS_MAP[planId]) {
          // Fallback to monthly if not found
          setSelectedPlan(DEFAULT_PLANS_MAP.plan_monthly);
        }
      } catch (error) {
        console.error("Error loading plan details:", error);
        setSelectedPlan(DEFAULT_PLANS_MAP.plan_monthly);
      } finally {
        setIsLoadingPlan(false);
      }
    }

    loadPlan();
  }, [planId]);

  const handleActivateSubscription = async (paymentDetails?: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
    if (!user) return;
    setIsProcessing(true);

    try {
      const response = await fetch('/api/subscription/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          planId: selectedPlan?.id || planId,
          isTestMode: !paymentDetails,
          ...paymentDetails
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to activate subscription.');
      }

      setIsSuccess(true);
      toast({
        title: "Subscription Activated! 🎉",
        description: `Your ${selectedPlan?.name || 'Screenplay Pro'} subscription is now active!`,
      });

      setTimeout(() => {
        router.push(returnUrl);
      }, 1500);

    } catch (error: any) {
      console.error("Error activating subscription:", error);
      toast({
        title: "Activation Error",
        description: error.message || "Failed to process subscription.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRazorpayPayment = async () => {
    if (!user || !selectedPlan) return;
    setIsProcessing(true);

    try {
      // 1. Create Order via API
      const orderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: selectedPlan.price * 100, // paise
          currency: 'INR'
        })
      });

      const orderData = await orderRes.json();

      if (orderRes.ok && orderData.success && typeof window !== 'undefined' && window.Razorpay) {
        // Razorpay keys exist and window.Razorpay is ready
        const options = {
          key: orderData.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount: orderData.amount,
          currency: orderData.currency,
          name: "Screenplay Pro",
          description: `${selectedPlan.name} Subscription`,
          order_id: orderData.id,
          prefill: {
            name: firestoreUser?.displayName || user.displayName || 'Screenwriter',
            email: user.email || firestoreUser?.email || '',
            contact: firestoreUser?.mobileNumber || ''
          },
          theme: {
            color: "#0f766e" // Primary Teal
          },
          handler: async function (response: any) {
            await handleActivateSubscription({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            });
          },
          modal: {
            ondismiss: function () {
              setIsProcessing(false);
            }
          }
        };

        const razorpayInstance = new window.Razorpay(options);
        razorpayInstance.open();
      } else {
        // Fallback: If Razorpay keys are not set on backend or test mode, proceed with instant activation
        console.warn("Razorpay order endpoint returned error or keys unconfigured. Using instant activation fallback.");
        await handleActivateSubscription();
      }
    } catch (error) {
      console.warn("Razorpay popup error. Falling back to instant activation:", error);
      await handleActivateSubscription();
    }
  };

  if (isLoadingPlan) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <div className="min-h-screen bg-background py-10 px-4">
        <div className="container mx-auto max-w-xl">
          
          <Button 
            variant="ghost" 
            className="mb-6 rounded-xl text-muted-foreground hover:text-foreground"
            onClick={() => router.push('/subscriptions')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Plans
          </Button>

          {isSuccess ? (
            <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-2xl rounded-3xl p-8 text-center space-y-4">
              <div className="h-16 w-16 bg-emerald-500/20 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-10 w-10 animate-bounce" />
              </div>
              <h2 className="text-3xl font-black tracking-tight">Payment Successful!</h2>
              <p className="text-muted-foreground text-sm font-medium">
                Your <strong>{selectedPlan?.name}</strong> has been activated successfully.
              </p>
              <p className="text-xs text-muted-foreground pt-2">
                Redirecting you back to your scripts...
              </p>
            </Card>
          ) : (
            <Card className="border-primary/20 shadow-2xl rounded-3xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 sm:p-8 border-b border-primary/10">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className="px-3 py-1 border-primary/20 text-primary bg-primary/10 font-bold uppercase tracking-wider text-[10px] rounded-full">
                    <Sparkles className="h-3 w-3 mr-1" /> Checkout
                  </Badge>
                  <span className="text-xs text-muted-foreground font-bold flex items-center gap-1">
                    <Lock className="h-3 w-3 text-emerald-600" /> Secure 256-Bit SSL
                  </span>
                </div>
                <CardTitle className="text-2xl sm:text-3xl font-black tracking-tight">
                  Complete Subscription
                </CardTitle>
                <CardDescription className="text-muted-foreground text-sm font-medium pt-1">
                  Upgrade to Screenplay Pro for unlimited PDF script exports and cloud sync.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6 sm:p-8 space-y-6">
                
                {/* PLAN SUMMARY */}
                <div className="p-5 rounded-2xl bg-secondary/30 border border-primary/10 space-y-3">
                  <div className="flex justify-between items-baseline">
                    <div>
                      <h3 className="text-lg font-black text-foreground">{selectedPlan?.name}</h3>
                      <p className="text-xs text-muted-foreground font-medium">
                        {selectedPlan?.durationDays === 3650 ? 'Lifetime Access' : `${selectedPlan?.durationDays} Days Access`}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black text-primary">₹{selectedPlan?.price}</span>
                      <span className="text-xs text-muted-foreground font-bold block">One-Time Payment</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-primary/10 space-y-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Plan Highlights:</p>
                    {selectedPlan?.features.map((feat, idx) => (
                      <div key={idx} className="flex items-center text-xs font-medium gap-2">
                        <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* USER ACCOUNT SUMMARY */}
                <div className="p-4 rounded-2xl bg-secondary/10 border border-primary/5 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase font-bold">Subscribing As</p>
                  <p className="text-sm font-bold text-foreground">{user?.displayName || firestoreUser?.displayName || 'Screenwriter'}</p>
                  <p className="text-xs text-muted-foreground font-medium">{user?.email || firestoreUser?.email}</p>
                </div>

              </CardContent>

              <CardFooter className="p-6 sm:p-8 bg-secondary/20 border-t border-primary/10 flex flex-col gap-3">
                <Button 
                  size="lg" 
                  className="w-full rounded-2xl font-black text-base py-6 shadow-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
                  onClick={handleRazorpayPayment}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing Payment...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="mr-2 h-5 w-5" /> Pay ₹{selectedPlan?.price} & Activate Now
                    </>
                  )}
                </Button>

                <p className="text-[11px] text-muted-foreground text-center font-medium leading-relaxed">
                  By completing payment, your Screenplay Pro PDF export privileges will activate instantly for your account.
                </p>
              </CardFooter>
            </Card>
          )}

        </div>
      </div>
    </ProtectedRoute>
  );
}
