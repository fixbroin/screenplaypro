"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, ShieldCheck, Check, Loader2, Lock, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const planId = searchParams.get('planId') || 'plan_monthly';
  const planNameParam = searchParams.get('planName');
  const amountParam = searchParams.get('amount');
  const daysParam = searchParams.get('days');
  const returnUrl = searchParams.get('returnUrl') || '/script-writing';

  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    async function loadPlan() {
      try {
        let initialPlan: SubscriptionPlan | null = DEFAULT_PLANS_MAP[planId] || null;

        if (amountParam && planNameParam) {
          initialPlan = {
            id: planId,
            name: planNameParam,
            price: Number(amountParam),
            durationDays: daysParam ? Number(daysParam) : 30,
            isActive: true,
            order: 1,
            features: [
              'Unlimited PDF Script Exports',
              'Studio-Standard Screenplay Formatting',
              'Multi-Language Script Typing',
              'Real-Time Cloud Autosave',
              'Standard Export Quality'
            ]
          };
        }

        setSelectedPlan(initialPlan);

        const res = await fetch('/api/db/subscription-plans');
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.plans)) {
            const found = json.plans.find((p: any) => p.id === planId);
            if (found) {
              setSelectedPlan({
                ...found,
                price: amountParam ? Number(amountParam) : found.price,
                name: planNameParam || found.name,
              });
            }
          }
        }
      } catch (e) {
        console.error("Error loading subscription plan:", e);
      } finally {
        setIsLoadingPlan(false);
      }
    }
    loadPlan();
  }, [planId, planNameParam, amountParam, daysParam]);

  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'paypal'>('razorpay');
  const [isPaypalEnabled, setIsPaypalEnabled] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/db/settings?key=applicationConfig');
        const json = await res.json();
        if (json.success && json.data) {
          if (json.data.enablePaypal) {
            setIsPaypalEnabled(true);
          }
        }
      } catch (e) {
        console.error("Failed to fetch payment settings:", e);
      }
    }
    loadSettings();
  }, []);

  // Handle returning from PayPal Approval Redirect
  useEffect(() => {
    const paypalToken = searchParams.get('token') || searchParams.get('paypal_order_id');
    const PayerID = searchParams.get('PayerID');

    if (paypalToken && PayerID && user && !isSuccess) {
      const currentUid = user.uid;
      async function capturePaypal() {
        setIsProcessing(true);
        try {
          const res = await fetch('/api/paypal/capture-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: paypalToken,
              userId: currentUid,
              planId: selectedPlan?.id || planId,
              durationDays: selectedPlan?.durationDays || 30,
            })
          });

          const data = await res.json();
          if (res.ok && data.success) {
            setIsSuccess(true);
            toast({
              title: "Subscription Activated! 🎉",
              description: `Payment captured via PayPal. You are now subscribed to ${selectedPlan?.name || 'Pro Pass'}.`,
            });
            setTimeout(() => {
              router.push(returnUrl);
            }, 2500);
          } else {
            throw new Error(data.error || 'Failed to capture PayPal payment.');
          }
        } catch (err: any) {
          toast({
            title: "PayPal Payment Failed",
            description: err.message || "Failed to finalize PayPal payment.",
            variant: "destructive"
          });
        } finally {
          setIsProcessing(false);
        }
      }
      capturePaypal();
    }
  }, [searchParams, user, selectedPlan, planId, returnUrl, isSuccess, router, toast]);

  const handlePayment = async () => {
    if (!user || !selectedPlan) return;
    setIsProcessing(true);

    if (paymentMethod === 'paypal') {
      try {
        // Create PayPal Order
        const paypalRes = await fetch('/api/paypal/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: selectedPlan.price,
            currency: 'USD',
            planName: selectedPlan.name,
            userId: user.uid,
            planId: selectedPlan.id,
          })
        });

        const paypalData = await paypalRes.json();
        if (!paypalRes.ok || !paypalData.success || !paypalData.approveUrl) {
          throw new Error(paypalData.error || 'Failed to initialize PayPal order.');
        }

        // Redirect user to PayPal approval URL
        window.location.href = paypalData.approveUrl;
      } catch (error: any) {
        toast({
          title: "PayPal Error",
          description: error.message || "Could not launch PayPal payment.",
          variant: "destructive"
        });
        setIsProcessing(false);
      }
      return;
    }

    // Razorpay Flow
    try {
      const amountInPaise = Math.max(100, Math.round(selectedPlan.price * 100));

      const orderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: 'INR',
          userId: user.uid,
          planId: selectedPlan.id,
        })
      });

      const orderData = await orderRes.json();

      if (!orderRes.ok || !orderData.success) {
        throw new Error(orderData.error || 'Failed to initialize payment gateway.');
      }

      const options = {
        key: orderData.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'Screenplay Pro',
        description: `Subscription: ${selectedPlan.name}`,
        order_id: orderData.id,
        handler: async function (response: any) {
          try {
            const activateRes = await fetch('/api/subscription/activate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: user.uid,
                planId: selectedPlan.id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            const activateData = await activateRes.json();
            if (activateRes.ok && activateData.success) {
              setIsSuccess(true);
              toast({
                title: "Subscription Activated! 🎉",
                description: `You are now subscribed to ${selectedPlan.name}.`,
              });
              setTimeout(() => {
                router.push(returnUrl);
              }, 2500);
            } else {
              throw new Error(activateData.error || 'Payment activation failed.');
            }
          } catch (err: any) {
            toast({
              title: "Activation Error",
              description: err.message || "Failed to activate subscription.",
              variant: "destructive"
            });
          } finally {
            setIsProcessing(false);
          }
        },
        prefill: {
          name: user.displayName || '',
          email: user.email || '',
        },
        theme: {
          color: '#0d9488'
        }
      };

      if (typeof window !== 'undefined' && window.Razorpay) {
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        throw new Error('Razorpay SDK failed to load. Please refresh and try again.');
      }
    } catch (error: any) {
      toast({
        title: "Payment Initialization Failed",
        description: error.message || "Could not launch payment gateway.",
        variant: "destructive"
      });
      setIsProcessing(false);
    }
  };

  const isReturningFromPaypal = Boolean(searchParams.get('token') || searchParams.get('paypal_order_id'));

  if (isLoadingPlan) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (isReturningFromPaypal || isProcessing || isSuccess) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto px-4 py-16 max-w-xl">
          {isSuccess ? (
            <Card className="border-emerald-500/30 bg-emerald-500/5 text-center p-8 space-y-4 shadow-lg rounded-2xl">
              <div className="h-16 w-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h2 className="text-2xl font-black text-emerald-600">Payment Successful! 🎉</h2>
              <p className="text-sm text-muted-foreground">
                Thank you for upgrading! Your subscription is active. Redirecting you to your workspace...
              </p>
              <div className="pt-4">
                <Button onClick={() => router.push(returnUrl)} className="font-bold">
                  Go to Script Workspace Now
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="border-blue-500/30 bg-blue-500/5 text-center p-8 space-y-4 shadow-lg rounded-2xl">
              <div className="h-16 w-16 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center mx-auto animate-pulse">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
              </div>
              <h2 className="text-2xl font-black text-blue-600">Finalizing Your PayPal Payment...</h2>
              <p className="text-sm text-muted-foreground">
                Please wait a moment while we verify your transaction and activate your subscription. Do not close or refresh this window.
              </p>
            </Card>
          )}
        </div>
      </ProtectedRoute>
    );
  }

  if (!selectedPlan) {
    return (
      <div className="text-center py-20 space-y-4">
        <h2 className="text-2xl font-bold">Plan Not Found</h2>
        <Button onClick={() => router.push('/subscriptions')}>Back to Subscriptions</Button>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" />
      <div className="container mx-auto px-4 py-8 max-w-xl space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>

        <Card className="border-primary/10 shadow-lg">
          <CardHeader className="text-center pb-4 border-b">
            <Badge variant="outline" className="w-fit mx-auto mb-2 text-xs font-bold uppercase tracking-wider text-primary">
              Secure Checkout
            </Badge>
            <CardTitle className="text-2xl font-black">{selectedPlan.name}</CardTitle>
            <CardDescription>Review your plan details and choose payment gateway.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="flex justify-between items-baseline p-4 rounded-2xl bg-secondary/20">
              <span className="font-bold text-sm">Total Amount</span>
              <span className="text-3xl font-black text-primary">₹{selectedPlan.price}</span>
            </div>

            {/* PAYMENT METHOD SELECTOR */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Payment Gateway:</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('razorpay')}
                  className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                    paymentMethod === 'razorpay'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20 font-bold'
                      : 'border-border bg-card hover:bg-accent/50'
                  }`}
                >
                  <span className="text-sm font-bold flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" /> Razorpay
                  </span>
                  <span className="text-[11px] text-muted-foreground mt-1">UPI, Cards, NetBanking</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('paypal')}
                  className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                    paymentMethod === 'paypal'
                      ? 'border-blue-500 bg-blue-500/5 ring-2 ring-blue-500/20 font-bold'
                      : 'border-border bg-card hover:bg-accent/50'
                  }`}
                >
                  <span className="text-sm font-bold flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                    PayPal
                  </span>
                  <span className="text-[11px] text-muted-foreground mt-1">International Cards & PayPal</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Included Features:</p>
              {selectedPlan.features?.map((feat, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs font-medium">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="pt-4 flex flex-col gap-3">
            <Button 
              onClick={handlePayment} 
              disabled={isProcessing}
              className={`w-full h-12 font-bold text-base rounded-xl text-white shadow-md ${
                paymentMethod === 'paypal' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-primary hover:bg-primary/90'
              }`}
            >
              {isProcessing ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <Lock className="h-4 w-4 mr-2" />
              )}
              {paymentMethod === 'paypal' ? `Pay with PayPal ($${selectedPlan.price})` : `Pay ₹${selectedPlan.price} with Razorpay`}
            </Button>
            <p className="text-[11px] text-center text-muted-foreground flex items-center justify-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> 256-Bit SSL Encrypted Payment Gateway
            </p>
          </CardFooter>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
