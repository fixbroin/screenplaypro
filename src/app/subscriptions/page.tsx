"use client";

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Check, ShieldCheck, Zap, Loader2, FileText, Languages, Download, Cloud, PenTool, AlertCircle, Calendar } from 'lucide-react';
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

  const isPdfExportReason = searchParams.get('reason') === 'pdf_export';

  useEffect(() => {
    const q = query(
      collection(db, "adminSubscriptionPlans"),
      where("isActive", "==", true),
      orderBy("order", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPlans = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as SubscriptionPlan));

      if (fetchedPlans.length > 0) {
        setPlans(fetchedPlans);
      } else {
        setPlans(DEFAULT_SCREENPLAY_PLANS);
      }
      setIsLoadingPlans(false);
    }, (error) => {
      console.error("Error fetching subscription plans:", error);
      setPlans(DEFAULT_SCREENPLAY_PLANS);
      setIsLoadingPlans(false);
    });

    return () => unsubscribe();
  }, []);

  const handlePurchase = (plan: SubscriptionPlan) => {
    if (!user) {
      toast({ title: "Login Required", description: "Please login or sign up to activate a subscription." });
      router.push(`/auth/login?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    
    setIsPurchasing(plan.id);
    const currentPath = window.location.pathname + window.location.search;
    router.push(`/checkout/payment?reason=subscription&planId=${plan.id}&returnUrl=${encodeURIComponent('/script-writing')}`);
  };

  const subStatus = checkSubscriptionStatus(firestoreUser, user?.email);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 sm:py-12 max-w-6xl">
        <Breadcrumbs items={[
          { label: 'Home', href: '/' },
          { label: 'Subscriptions' }
        ]} className="mb-8" />

        {/* REASON NOTICE */}
        {isPdfExportReason && (
          <div className="mb-8 p-4 md:p-6 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-4 text-amber-800 dark:text-amber-200">
            <AlertCircle className="w-6 h-6 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div>
              <h3 className="font-bold text-base md:text-lg">Subscription Required to Export PDF</h3>
              <p className="text-sm mt-1 leading-relaxed opacity-90">
                Anyone can write and edit screenplays for free. To download, print, or export your script as a PDF, please activate or renew a Screenplay Pro subscription plan below.
              </p>
            </div>
          </div>
        )}

        <div className="text-center mb-10">
          <Badge variant="outline" className="mb-4 px-4 py-1.5 border-primary/20 text-primary bg-primary/5 rounded-full font-bold uppercase tracking-wider text-xs">
            <Sparkles className="h-4 w-4 mr-2" /> SCREENPLAY PRO SUBSCRIPTIONS
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-headline font-black tracking-tight mb-4">
            Unlock Unlimited PDF Script Exports
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            Write for free anytime. Upgrade to Screenplay Pro to export studio-ready PDFs, translate scripts into Indian languages, and sync to the cloud.
          </p>
        </div>

        {/* USER SUBSCRIPTION STATUS CARD */}
        {user && (
          <Card className={cn(
            "mb-12 border overflow-hidden shadow-lg transition-all",
            subStatus.isActive ? "border-emerald-500/30 bg-emerald-500/5" : subStatus.isExpired ? "border-destructive/30 bg-destructive/5" : "border-primary/20 bg-primary/5"
          )}>
            <CardContent className="p-6 md:p-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className={cn(
                    "h-14 w-14 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0",
                    subStatus.isActive ? "bg-emerald-600 shadow-emerald-500/30" : subStatus.isExpired ? "bg-destructive shadow-destructive/30" : "bg-primary shadow-primary/30"
                  )}>
                    <ShieldCheck className="h-7 w-7" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-xl md:text-2xl font-black tracking-tight">Your Subscription Status</h2>
                      {subStatus.isActive ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">ACTIVE</Badge>
                      ) : subStatus.isExpired ? (
                        <Badge variant="destructive" className="font-bold">EXPIRED</Badge>
                      ) : (
                        <Badge variant="outline" className="font-bold">INACTIVE</Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {subStatus.isActive 
                        ? subStatus.expiresDate 
                          ? `Active Plan — Expires on ${subStatus.expiresDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} (${subStatus.daysRemaining} days remaining)`
                          : `Unlimited Access Plan`
                        : subStatus.isExpired 
                          ? `Your plan expired on ${subStatus.expiresDate?.toLocaleDateString()}. Please renew below to continue downloading PDFs.`
                          : "You do not have an active Screenplay Pro PDF export plan yet."}
                    </p>
                  </div>
                </div>

                {subStatus.isActive ? (
                  <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-bold px-6 shadow-md" onClick={() => router.push('/script-writing')}>
                    <FileText className="mr-2 h-4 w-4" /> Go to Script Editor
                  </Button>
                ) : (
                  <Button size="lg" className="rounded-full font-bold px-8 shadow-md" onClick={() => {
                    const firstPlan = plans[0];
                    if (firstPlan) handlePurchase(firstPlan);
                  }}>
                    <Zap className="mr-2 h-4 w-4" /> Activate Plan Now
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* PLANS GRID */}
        {isLoadingPlans ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="h-96 rounded-3xl animate-pulse bg-muted/40" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {plans.map((plan, index) => {
              const isRecommended = index === 1 || plan.name.toLowerCase().includes('annual') || plan.name.toLowerCase().includes('pro');
              return (
                <Card 
                  key={plan.id}
                  className={cn(
                    "flex flex-col relative rounded-3xl transition-all duration-300 border-2 overflow-hidden",
                    isRecommended 
                      ? "border-primary shadow-xl scale-105 z-10 bg-card" 
                      : "border-border/60 hover:border-primary/40 shadow-sm hover:shadow-md"
                  )}
                >
                  {isRecommended && (
                    <div className="bg-primary text-primary-foreground text-[11px] font-black uppercase tracking-widest text-center py-1.5">
                      MOST POPULAR FOR SCREENWRITERS
                    </div>
                  )}

                  <CardHeader className="pt-6 pb-4">
                    <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      {plan.durationDays >= 365 ? '1 Year Pass' : plan.durationDays > 30 ? `${plan.durationDays} Days Pass` : '30 Days Pass'}
                    </CardDescription>

                    <div className="pt-4 flex items-baseline gap-1">
                      <span className="text-4xl font-black text-foreground">₹{plan.price}</span>
                      <span className="text-xs font-semibold text-muted-foreground">
                        / {plan.durationDays >= 365 ? 'yr' : 'mo'}
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 space-y-3 py-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Included Features:</p>
                    {(plan.features && plan.features.length > 0 ? plan.features : [
                      'Unlimited PDF Script Exports',
                      'Studio-Standard Formatting',
                      'Multi-Language Typing',
                      'Cloud Sync & Autosave'
                    ]).map((feat, fIdx) => (
                      <div key={fIdx} className="flex items-start gap-3 text-sm">
                        <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span className="text-muted-foreground leading-snug">{feat}</span>
                      </div>
                    ))}
                  </CardContent>

                  <CardFooter className="pt-4 pb-6">
                    <Button 
                      className={cn(
                        "w-full rounded-full font-bold py-6 text-sm shadow-md transition-all",
                        isRecommended ? "bg-primary text-primary-foreground hover:bg-primary/90" : "variant-outline"
                      )}
                      variant={isRecommended ? "default" : "outline"}
                      disabled={isPurchasing === plan.id}
                      onClick={() => handlePurchase(plan)}
                    >
                      {isPurchasing === plan.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
                        </>
                      ) : (
                        `Subscribe Now — ₹${plan.price}`
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}

        {/* FAQ SECTION */}
        <div className="mt-20 border-t pt-16">
          <div className="text-center mb-10 max-w-2xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Subscription FAQs</h2>
            <p className="text-sm text-muted-foreground">Common questions about Screenplay Pro subscriptions and PDF exports.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="p-6 bg-secondary/20 rounded-2xl border border-primary/5">
              <h3 className="font-bold text-base mb-2">Can I write scripts without a subscription?</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Yes! Anyone can register, write, format, edit, and autosave scripts to the cloud for free without any subscription.
              </p>
            </div>
            <div className="p-6 bg-secondary/20 rounded-2xl border border-primary/5">
              <h3 className="font-bold text-base mb-2">When do I need a subscription?</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                A subscription is required when you want to export and download your script as an industry-standard PDF file.
              </p>
            </div>
            <div className="p-6 bg-secondary/20 rounded-2xl border border-primary/5">
              <h3 className="font-bold text-base mb-2">What happens when my subscription expires?</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your saved scripts remain safe in your cloud account. You can still view and edit them for free, and renew your subscription whenever you wish to download new PDFs.
              </p>
            </div>
            <div className="p-6 bg-secondary/20 rounded-2xl border border-primary/5">
              <h3 className="font-bold text-base mb-2">Are multi-language scripts supported in PDF?</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Yes! Screenplay Pro renders PDF scripts in English, Kannada, Hindi, Telugu, Tamil, Malayalam, Marathi, Bengali, and more with embedded fonts.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
