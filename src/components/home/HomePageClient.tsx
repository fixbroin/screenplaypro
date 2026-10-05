"use client";

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import JsonLdScript from '@/components/shared/JsonLdScript';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { GlobalWebSettings, FirestoreSEOSettings, FeaturesConfiguration, HomepageAd, AdPlacement } from '@/types/firestore';
import Breadcrumbs from '@/components/shared/Breadcrumbs';
import type { BreadcrumbItem } from '@/types/ui';
import { useLoading } from '@/contexts/LoadingContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Sparkles, FileText, Languages, Download, Cloud, PenTool, CheckCircle2, Star, ArrowRight, ShieldCheck, Zap, Laptop } from 'lucide-react';
import AdBannerCard from '@/components/shared/AdBannerCard';
import { getCache, setCache } from '@/lib/client-cache';
import * as React from "react";
import type { HomepageData } from '@/lib/homepageUtils';
import { LazySection } from '@/components/shared/LazySection';

const isBot = (): boolean => {
  if (typeof window === 'undefined') return true;
  const botPatterns = [
    'bot', 'crawler', 'spider', 'crawling', 'googlebot', 'bingbot', 'yandexbot', 
    'slurp', 'duckduckbot', 'baiduspider', 'adsbot', 'mediapartners-google',
    'lighthouse', 'gtmetrix', 'pingdom', 'facebookexternalhit', 'whatsapp', 'linkedinbot'
  ];
  const ua = navigator.userAgent.toLowerCase();
  return botPatterns.some(pattern => ua.includes(pattern));
};

// Lazy load components
const HeroCarousel = dynamic(() => import('@/components/home/HeroCarousel').then((mod) => mod.HeroCarousel), {
  loading: () => <Skeleton className="h-[180px] sm:h-[250px] md:h-[300px] lg:h-[400px] xl:h-[450px] w-full rounded-lg" />,
});

const HomeBlogSection = dynamic(() => import('@/components/home/HomeBlogSection'), {
  loading: () => (
    <div className="flex w-full space-x-4 p-1 pb-3 overflow-hidden">
      {[...Array(4)].map((_, i) => (
        <Card key={i} className="w-[250px] sm:w-[280px] flex-shrink-0 snap-start">
          <Skeleton className="h-32 sm:h-36 w-full" />
          <CardContent className="p-2 sm:p-3">
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/2 mt-1" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
});

const WhyChooseUs = dynamic(() => import('@/components/home/WhyChooseUs'), {
  loading: () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-lg" />)}
    </div>
  ),
});

const Testimonials = dynamic(() => import('@/components/home/Testimonials'), {
  loading: () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-56 w-full rounded-lg" />)}
    </div>
  ),
});

const SectionHeader: React.FC<{ 
  title: string; 
  icon?: React.ReactNode; 
  subtitle?: string; 
  centered?: boolean;
  isH1?: boolean;
}> = ({ title, icon, subtitle, centered = true, isH1 = false }) => {
  const TitleTag = isH1 ? 'h1' : 'h2';
  return (
    <div className={cn("mb-8 md:mb-12", centered ? "text-center" : "text-left")}>
      <TitleTag className={cn(
        "font-headline font-semibold text-foreground flex items-center gap-2", 
        isH1 ? "text-2xl md:text-4xl" : "text-xl md:text-3xl",
        centered ? "justify-center" : "justify-start"
      )}>
        {icon} {title}
      </TitleTag>
      {subtitle && <p className="text-muted-foreground mt-2 text-sm md:text-base max-w-2xl mx-auto">{subtitle}</p>}
    </div>
  );
};

const FEATURES_CONFIG_COLLECTION = "webSettings";
const FEATURES_CONFIG_DOC_ID = "featuresConfiguration";

const defaultFeaturesConfig: FeaturesConfiguration = {
  showMostPopularServices: true,
  showRecentlyAddedServices: true,
  showCategoryWiseServices: true,
  showBlogSection: true,
  showCustomServiceButton: false,
  homepageCategoryVisibility: {},
  ads: [],
};

interface HomePageClientProps {
  citySlug?: string;
  areaSlug?: string;
  breadcrumbItems?: BreadcrumbItem[];
  initialData?: HomepageData;
  initialH1Title?: string;
}

export default function HomePageClient({ citySlug, areaSlug, breadcrumbItems, initialData, initialH1Title }: HomePageClientProps) {
  const { user } = useAuth();
  const { config: appConfig, isLoading: isLoadingAppSettings } = useApplicationConfig();
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();
  const isVisitorBot = React.useRef(isBot());
  const [structuredData, setStructuredData] = useState<Record<string, any> | null>(() => getCache<Record<string, any>>('structuredData', true) || null);
  const [seoSettings, setSeoSettings] = useState<FirestoreSEOSettings | null>(() => initialData?.seoSettings || getCache<FirestoreSEOSettings>('seoSettings', true) || null);
  const [pageH1, setPageH1] = useState<string | undefined>(() => initialH1Title || initialData?.seoSettings.homepageH1 || getCache<string>('pageH1', true) || undefined);
  const { showLoading } = useLoading();

  const [featuresConfig, setFeaturesConfig] = useState<FeaturesConfiguration>(() => initialData?.featuresConfig || getCache<FeaturesConfiguration>('featuresConfig', true) || defaultFeaturesConfig);
  const [activeAds, setActiveAds] = useState<HomepageAd[]>(() => (initialData?.featuresConfig.ads || getCache<FeaturesConfiguration>('featuresConfig', true)?.ads || []).filter(ad => ad.isActive).sort((a, b) => a.order - b.order));
  
  const [isLoadingPageData, setIsLoadingPageData] = useState(() => !initialData && !getCache('pageH1', true));

  const setupRealtimeListeners = useCallback(() => {
    if (isVisitorBot.current) {
      return () => {};
    }

    const configDocRef = doc(db, FEATURES_CONFIG_COLLECTION, FEATURES_CONFIG_DOC_ID);
    const unsubscribeConfig = onSnapshot(configDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const config = { ...defaultFeaturesConfig, ...(docSnap.data() as Partial<FeaturesConfiguration>) };
        setFeaturesConfig(config);
        setCache('featuresConfig', config, true);
        setActiveAds((config.ads || []).filter(ad => ad.isActive).sort((a, b) => a.order - b.order));
      }
    }, (error) => console.error("Error listening to features config:", error));

    return () => {
      unsubscribeConfig();
    };
  }, []);

  useEffect(() => {
    setIsMounted(true);
    if (initialData) {
      setCache('featuresConfig', initialData.featuresConfig, true);
      setCache('seoSettings', initialData.seoSettings, true);
    }
    
    setIsLoadingPageData(false);
    const cleanupListeners = setupRealtimeListeners();
    return () => {
      if (cleanupListeners) cleanupListeners();
    };
  }, [initialData, setupRealtimeListeners]);

  const handleStartWriting = useCallback(() => {
    showLoading();
    router.push("/script-writing");
  }, [router, showLoading]);

  const displayHeroCarousel = !isLoadingAppSettings && (appConfig.enableHeroCarousel ?? true);
  const finalH1 = pageH1 || initialH1Title || "Professional Screenplay Writing Platform";

  const renderAdsByPlacement = (placement: AdPlacement) => {
    const adsForPlacement = activeAds.filter(ad => ad.placement === placement);
    if (adsForPlacement.length === 0) return null;
    return (
      <div className="container mx-auto px-0 md:px-4 my-2 md:my-4 space-y-2">
        {adsForPlacement.map(ad => <AdBannerCard key={ad.id} ad={ad} />)}
      </div>
    );
  };

  if (!isMounted || isLoadingPageData) {
    return (
      <div className="flex flex-col">
        <div className="container mx-auto px-4 pt-4 md:pt-6 mb-4 md:mb-6">
          <Skeleton className="h-5 w-1/3" />
        </div>
        <section className="py-6 md:py-10">
          <div className="container mx-auto px-4">
            <Skeleton className="h-[180px] sm:h-[250px] md:h-[300px] lg:h-[400px] xl:h-[450px] w-full rounded-lg" />
          </div>
        </section>
      </div>
    );
  }

  const featuresList = [
    {
      icon: <PenTool className="h-8 w-8 text-primary" />,
      title: "Industry-Standard Formatting",
      description: "Auto-formats Scene Headings, Action lines, Characters, Parentheticals, Dialogues, and Transitions effortlessly."
    },
    {
      icon: <Languages className="h-8 w-8 text-indigo-500" />,
      title: "Multi-Language Scripting",
      description: "Write screenplays in English, Hindi, Kannada, Tamil, Telugu, Malayalam, Marathi, Bengali, and more."
    },
    {
      icon: <Download className="h-8 w-8 text-emerald-500" />,
      title: "One-Click PDF Export",
      description: "Export clean, standard PDF scripts formatted according to professional studio and production house guidelines."
    },
    {
      icon: <Cloud className="h-8 w-8 text-sky-500" />,
      title: "Real-time Autosave & Cloud Sync",
      description: "Never lose a line of inspiration. Your script changes are safely synchronized and saved automatically."
    },
    {
      icon: <Sparkles className="h-8 w-8 text-amber-500" />,
      title: "Instant Script Translation",
      description: "Translate your film or web series script between Indian regional languages and English with built-in AI tools."
    },
    {
      icon: <ShieldCheck className="h-8 w-8 text-rose-500" />,
      title: "Copyright & Intellectual Protection",
      description: "Keep your movie concepts, treatments, and screenplays encrypted, private, and securely under your control."
    }
  ];

  return (
    <>
      {structuredData && <JsonLdScript data={structuredData} idSuffix={citySlug || areaSlug || 'homepage'} />}
      <div className="flex flex-col">
        {breadcrumbItems && breadcrumbItems.length > 0 && (
          <div className="container mx-auto px-4 pt-4 md:pt-6">
            <Breadcrumbs items={breadcrumbItems} />
          </div>
        )}

        {/* HERO SLIDESHOW */}
        {displayHeroCarousel && (
          <section className="py-4 md:py-6">
            <div className="container mx-auto px-4 overflow-hidden">
              <HeroCarousel />
            </div>
          </section>
        )}

        {renderAdsByPlacement('AFTER_HERO_CAROUSEL')}

        {/* SCREENPLAY PRO INTRO HERO */}
        <section className="py-12 md:py-20 bg-gradient-to-b from-primary/5 via-background to-background border-b border-border/40">
          <div className="container mx-auto px-4 text-center max-w-4xl">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-6">
              <Sparkles className="w-4 h-4" /> Screenplay Pro — Empowering Screenwriters
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-headline font-black tracking-tight text-foreground mb-6 leading-tight">
              Write & Format Movie Scripts Like a Professional
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-8 leading-relaxed">
              Screenplay Pro gives filmmakers, playwrights, and screenwriters an industry-standard editor with auto-formatting, multi-language typing, and studio-ready PDF exports.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="w-full sm:w-auto text-base px-8 py-6 rounded-full font-bold shadow-lg hover:shadow-xl transition-all" onClick={handleStartWriting}>
                <PenTool className="mr-2 h-5 w-5" /> Start Writing Free
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto text-base px-8 py-6 rounded-full font-bold" onClick={() => router.push('/subscriptions')}>
                Explore Pricing & Plans
              </Button>
            </div>
          </div>
        </section>

        {/* SCREENPLAY EDITOR PREVIEW MOCKUP */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="bg-card border border-border rounded-3xl p-6 md:p-10 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 mb-6">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="h-3 w-3 shrink-0 rounded-full bg-red-500" />
                  <div className="h-3 w-3 shrink-0 rounded-full bg-yellow-500" />
                  <div className="h-3 w-3 shrink-0 rounded-full bg-green-500" />
                  <span className="text-xs font-mono text-muted-foreground ml-2 truncate">Screenplay_Pro_Editor.sp</span>
                </div>
                <Badge variant="secondary" className="text-xs w-fit shrink-0 self-start sm:self-auto font-medium">Industry Standard Format</Badge>
              </div>
              <div className="font-mono text-sm space-y-4 text-foreground bg-muted/20 p-6 rounded-2xl border">
                <p className="font-bold text-primary tracking-wider uppercase">INT. COFFEE SHOP - DAY</p>
                <p className="text-muted-foreground pl-4 border-l-2 border-primary/20">
                  RAHUL (30s) sits across from PRIYA (28). Steam rises from two untouched espresso cups between them.
                </p>
                <div className="text-center my-2">
                  <p className="font-bold uppercase tracking-wider">RAHUL</p>
                  <p className="text-xs italic text-muted-foreground">(leaning forward, voice trembling)</p>
                  <p className="text-foreground">Have you read the latest scene rewrite?</p>
                </div>
                <div className="text-center my-2">
                  <p className="font-bold uppercase tracking-wider">PRIYA</p>
                  <p className="text-foreground">Every single word. It changes everything.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {renderAdsByPlacement('AFTER_CATEGORY_SECTIONS')}

        {/* FEATURES GRID */}
        <LazySection>
          <section className="py-12 md:py-16 bg-secondary/20">
            <div className="container mx-auto px-4">
              <SectionHeader 
                title="Everything You Need to Write Great Screenplays" 
                subtitle="Designed specifically for writers, film directors, and content creators."
              />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                {featuresList.map((feature, idx) => (
                  <Card key={idx} className="border border-border/60 hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md">
                    <CardHeader>
                      <div className="p-3 w-fit rounded-2xl bg-primary/5 mb-3">
                        {feature.icon}
                      </div>
                      <CardTitle className="text-lg font-bold">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-sm text-muted-foreground leading-relaxed">
                        {feature.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        </LazySection>

        {/* WHY CHOOSE US & TESTIMONIALS */}
        <LazySection>
          <section className="py-12 md:py-16">
            <div className="container mx-auto px-4">
              <SectionHeader title="Why Choose Screenplay Pro" />
              <WhyChooseUs />
            </div>
          </section>
        </LazySection>

        <LazySection>
          <section className="py-12 md:py-16 bg-secondary/30">
            <div className="container mx-auto px-4">
              <SectionHeader title="Loved by Writers & Filmmakers" />
              <Testimonials />
            </div>
          </section>
        </LazySection>
        
        {featuresConfig.showBlogSection && (
          <LazySection>
            <HomeBlogSection />
          </LazySection>
        )}
        
        {renderAdsByPlacement('BEFORE_FOOTER_CTA')}

        {/* CALL TO ACTION */}
        <section className="py-14 md:py-20 text-center bg-primary text-primary-foreground">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="text-3xl md:text-5xl font-headline font-black mb-6 tracking-tight">
              Ready to Write Your Next Blockbuster Screenplay?
            </h2>
            <p className="text-lg md:text-xl mb-8 text-primary-foreground/90 leading-relaxed">
              Join thousands of screenwriters crafting scripts, web series, short films, and plays on Screenplay Pro.
            </p>
            <Button
              size="lg"
              variant="secondary"
              className="text-base px-10 py-6 rounded-full font-bold bg-background text-primary hover:bg-background/90 shadow-xl"
              onClick={handleStartWriting}
            >
              Open Script Writing Editor <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </section>

      </div>
    </>
  );
}
