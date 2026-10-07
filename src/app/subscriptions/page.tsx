"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Check, ShieldCheck, Zap, Loader2, FileText, Languages, Download, Cloud, AlertCircle, Calendar, CreditCard, DollarSign, Lock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useRouter, useSearchParams } from 'next/navigation';
import Breadcrumbs from '@/components/shared/Breadcrumbs';
import { useToast } from '@/hooks/use-toast';
import type { SubscriptionPlan } from '@/types/firestore';
import { cn } from '@/lib/utils';
import { checkSubscriptionStatus } from '@/lib/subscriptionUtils';

const DEFAULT_SCREENPLAY_PLANS: SubscriptionPlan[] = [
  {
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
  {
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
  {
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
];

export default function SubscriptionsPage() {
  const { user, firestoreUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState<string | null>(null);

  // Payment Gateways Config State
  const [isRazorpayEnabled, setIsRazorpayEnabled] = useState(true);
  const [isPaypalEnabled, setIsPaypalEnabled] = useState(false);
  const [selectedPlanForModal, setSelectedPlanForModal] = useState<SubscriptionPlan | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const isPdfExportReason = searchParams.get('reason') === 'pdf_export';

  useEffect(() => {
    setIsLoadingPlans(true);
    fetch('/api/db/subscription-plans')
      .then(res => res.json())
      .then(json => {
        if (json.success && Array.isArray(json.plans) && json.plans.length > 0) {
          const activePlans = json.plans.filter((p: any) => p.isActive);
          setPlans(activePlans.length > 0 ? activePlans : DEFAULT_SCREENPLAY_PLANS);
        } else {
          setPlans(DEFAULT_SCREENPLAY_PLANS);
        }
      })
      .catch((err) => {
        console.error("Error fetching plans from MySQL:", err);
        setPlans(DEFAULT_SCREENPLAY_PLANS);
      })
      .finally(() => setIsLoadingPlans(false));

    // Load App Payment Settings to check enabled gateways
    fetch('/api/db/settings?key=applicationConfig')
      .then(res => res.json())
      .then(json => {
        if (json.success && json.data) {
          setIsRazorpayEnabled(json.data.enableOnlinePayment ?? true);
          setIsPaypalEnabled(json.data.enablePaypal ?? false);
        }
      })
      .catch(e => console.error("Error fetching payment settings:", e));
  }, []);

  const subscriptionInfo = checkSubscriptionStatus(firestoreUser);

  const proceedToCheckout = (plan: SubscriptionPlan, method: 'razorpay' | 'paypal') => {
    setIsModalOpen(false);
    router.push(`/checkout/payment?planId=${plan.id}&planName=${encodeURIComponent(plan.name)}&amount=${plan.price}&days=${plan.durationDays}&paymentMethod=${method}`);
  };

  const handleSelectPlan = async (plan: SubscriptionPlan) => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please sign in to upgrade your subscription.",
        variant: "destructive"
      });
      router.push(`/auth/login?redirect=/subscriptions`);
      return;
    }

    // If BOTH Razorpay and PayPal are enabled, show Pop-up modal!
    if (isRazorpayEnabled && isPaypalEnabled) {
      setSelectedPlanForModal(plan);
      setIsModalOpen(true);
      return;
    }

    // Otherwise proceed with the only enabled payment gateway
    const activeMethod = isPaypalEnabled ? 'paypal' : 'razorpay';
    proceedToCheckout(plan, activeMethod);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-8">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Subscriptions' }]} />

      {/* Header Banner */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <Badge variant="outline" className="px-3 py-1 text-xs font-black uppercase tracking-wider text-primary border-primary/20 bg-primary/5">
          <Sparkles className="h-3.5 w-3.5 mr-1.5 inline" /> Upgrade Your Screenwriting
        </Badge>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-foreground">
          Choose the Perfect Writer Plan
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg">
          Unlock unlimited PDF script exports, AI multi-language translation, and premium screenplay formatting tools.
        </p>

        {isPdfExportReason && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 text-sm font-semibold flex items-center justify-center gap-2 max-w-xl mx-auto">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
            <span>You need an active subscription to export PDF scripts without watermark!</span>
          </div>
        )}
      </div>

      {/* Current Subscription Card */}
      {firestoreUser && (
        <Card className="border-primary/10 bg-secondary/10 shadow-sm max-w-2xl mx-auto">
          <CardContent className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <span className="text-xs uppercase font-bold text-muted-foreground">Current Status</span>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <h3 className="font-bold text-lg">{firestoreUser.subscriptionPlanName || subscriptionInfo.statusText}</h3>
                <Badge variant={subscriptionInfo.isActive ? "default" : "secondary"}>
                  {subscriptionInfo.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              {subscriptionInfo.expiresDate && (
                <p className="text-xs text-muted-foreground flex items-center justify-center sm:justify-start gap-1 pt-1">
                  <Calendar className="h-3.5 w-3.5" /> Expires on: {subscriptionInfo.expiresDate.toLocaleDateString('en-IN')}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plans Grid */}
      {isLoadingPlans ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          {plans.map((plan) => {
            const isPopular = plan.order === 2 || plan.name.toLowerCase().includes('annual') || plan.name.toLowerCase().includes('pro');
            const isCurrentPlan = firestoreUser?.currentSubscriptionId === plan.id && subscriptionInfo.isActive;

            return (
              <Card 
                key={plan.id}
                className={cn(
                  "relative flex flex-col transition-all duration-300 hover:shadow-xl border-primary/10",
                  isPopular && "border-2 border-primary shadow-lg scale-105 z-10 bg-background"
                )}
              >
                {isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-md flex items-center gap-1">
                    <Zap className="h-3 w-3 fill-current" /> Most Popular
                  </div>
                )}

                <CardHeader className="pt-8 pb-4 text-center">
                  <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                  <div className="pt-4 flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-black">₹{plan.price}</span>
                    <span className="text-xs text-muted-foreground font-semibold">
                      / {plan.durationDays >= 365 ? (plan.durationDays >= 3000 ? 'Lifetime' : 'Year') : `${plan.durationDays} Days`}
                    </span>
                  </div>
                  <CardDescription className="text-xs pt-1">
                    {plan.durationDays >= 3650 ? 'One-time payment' : `Billed every ${plan.durationDays} days`}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-grow space-y-3 pt-2">
                  <div className="border-t border-border pt-4 space-y-2.5">
                    {plan.features?.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs font-medium text-foreground">
                        <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>

                <CardFooter className="pt-6 pb-6">
                  <Button 
                    className={cn(
                      "w-full font-bold text-sm h-11 rounded-xl shadow-md",
                      isPopular ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    )}
                    disabled={isPurchasing === plan.id || isCurrentPlan}
                    onClick={() => handleSelectPlan(plan)}
                  >
                    {isPurchasing === plan.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : isCurrentPlan ? (
                      <ShieldCheck className="h-4 w-4 mr-2" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    {isCurrentPlan ? 'Current Plan' : 'Subscribe Now'}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Feature Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-12 text-center">
        <div className="p-5 rounded-2xl bg-secondary/10 space-y-2">
          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <FileText className="h-5 w-5" />
          </div>
          <h4 className="font-bold text-sm">Industry Standard PDF</h4>
          <p className="text-xs text-muted-foreground">Export standard screenplay formatted PDFs anytime.</p>
        </div>
        <div className="p-5 rounded-2xl bg-secondary/10 space-y-2">
          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Languages className="h-5 w-5" />
          </div>
          <h4 className="font-bold text-sm">Multi-Language Typing</h4>
          <p className="text-xs text-muted-foreground">Write scripts in Hindi, Telugu, Tamil, Malayalam & English.</p>
        </div>
        <div className="p-5 rounded-2xl bg-secondary/10 space-y-2">
          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Cloud className="h-5 w-5" />
          </div>
          <h4 className="font-bold text-sm">Auto Cloud Backup</h4>
          <p className="text-xs text-muted-foreground">Never lose a single word with real-time MySQL cloud saving.</p>
        </div>
      </div>

      {/* POP-UP MODAL FOR PAYMENT GATEWAY CHOICE */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6">
          <DialogHeader className="text-center pb-2">
            <DialogTitle className="text-2xl font-black">Choose Payment Method</DialogTitle>
            <DialogDescription>
              Select your preferred payment gateway to upgrade to <span className="font-bold text-foreground">{selectedPlanForModal?.name}</span> for ₹{selectedPlanForModal?.price}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 gap-3">
              {/* RAZORPAY BUTTON */}
              <button
                type="button"
                onClick={() => selectedPlanForModal && proceedToCheckout(selectedPlanForModal, 'razorpay')}
                className="w-full p-4 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 flex items-center justify-between group transition-all text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground">Razorpay Payment Gateway</h4>
                    <p className="text-xs text-muted-foreground">UPI, Credit/Debit Cards, NetBanking, Wallets</p>
                  </div>
                </div>
                <Badge className="bg-emerald-500 text-white font-bold text-[10px]">INR ₹</Badge>
              </button>

              {/* PAYPAL BUTTON */}
              <button
                type="button"
                onClick={() => selectedPlanForModal && proceedToCheckout(selectedPlanForModal, 'paypal')}
                className="w-full p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 flex items-center justify-between group transition-all text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-blue-600 dark:text-blue-400">PayPal International</h4>
                    <p className="text-xs text-muted-foreground">International Cards & PayPal Balance</p>
                  </div>
                </div>
                <Badge className="bg-blue-600 text-white font-bold text-[10px]">USD $</Badge>
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
