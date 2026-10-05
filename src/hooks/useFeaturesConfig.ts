"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from '@/lib/firebase';
import type { FeaturesConfiguration, MarketingAutomationSettings } from '@/types/firestore';
import { getCache, setCache } from '@/lib/client-cache';

const FEATURES_CONFIG_COLLECTION = "webSettings";
const FEATURES_CONFIG_DOC_ID = "featuresConfiguration";
const MARKETING_AUTOMATION_DOC_ID = "marketingAutomation";
const CACHE_KEY = "features-and-marketing-config";

const defaultFeaturesConfig: FeaturesConfiguration = {
  showMostPopularServices: true,
  showRecentlyAddedServices: true,
  showCategoryWiseServices: true,
  showBlogSection: true,
  showCustomServiceButton: true,
  isSubscriptionRequired: true,
  homepageCategoryVisibility: {},
  ads: [],
};

interface UseFeaturesAndAutomationConfigReturn {
  featuresConfig: FeaturesConfiguration;
  config: FeaturesConfiguration; // Alias for backward compatibility
  marketingConfig: MarketingAutomationSettings | null;
  isLoading: boolean;
}

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

export function useFeaturesConfig(): UseFeaturesAndAutomationConfigReturn {
  const [featuresConfig, setFeaturesConfig] = useState<FeaturesConfiguration>(() => {
    const cached = getCache<{features: FeaturesConfiguration, marketing: MarketingAutomationSettings | null}>(CACHE_KEY, true);
    return cached ? cached.features : defaultFeaturesConfig;
  });
  const [marketingConfig, setMarketingConfig] = useState<MarketingAutomationSettings | null>(() => {
    const cached = getCache<{features: FeaturesConfiguration, marketing: MarketingAutomationSettings | null}>(CACHE_KEY, true);
    return cached ? cached.marketing : null;
  });
  const [isLoading, setIsLoading] = useState(!getCache(CACHE_KEY, true));
  const hasLoadedRef = useRef(false);
  const isVisitorBot = useRef(isBot());

  useEffect(() => {
    if (isVisitorBot.current) {
      setIsLoading(false);
      return;
    }

    const featuresDocRef = doc(db, FEATURES_CONFIG_COLLECTION, FEATURES_CONFIG_DOC_ID);
    const marketingDocRef = doc(db, FEATURES_CONFIG_COLLECTION, MARKETING_AUTOMATION_DOC_ID);

    // Real-time synchronization for features
    const unsubscribeFeatures = onSnapshot(featuresDocRef, (snap) => {
      const freshFeatures = snap.exists() 
        ? { ...defaultFeaturesConfig, ...snap.data() } as FeaturesConfiguration 
        : defaultFeaturesConfig;
      setFeaturesConfig(freshFeatures);
      
      // Update cache
      const currentMarketing = getCache<{features: FeaturesConfiguration, marketing: MarketingAutomationSettings | null}>(CACHE_KEY, true)?.marketing || null;
      setCache(CACHE_KEY, { features: freshFeatures, marketing: currentMarketing }, true);
      setIsLoading(false);
    }, (error) => {
      console.error("Error with features onSnapshot:", error);
    });

    // Real-time synchronization for marketing
    const unsubscribeMarketing = onSnapshot(marketingDocRef, (snap) => {
      const freshMarketing = snap.exists() 
        ? snap.data() as MarketingAutomationSettings 
        : null;
      setMarketingConfig(freshMarketing);

      // Update cache
      const currentFeatures = getCache<{features: FeaturesConfiguration, marketing: MarketingAutomationSettings | null}>(CACHE_KEY, true)?.features || defaultFeaturesConfig;
      setCache(CACHE_KEY, { features: currentFeatures, marketing: freshMarketing }, true);
    }, (error) => {
      console.error("Error with marketing onSnapshot:", error);
    });

    return () => {
      unsubscribeFeatures();
      unsubscribeMarketing();
    };
  }, []);

  return { featuresConfig, config: featuresConfig, marketingConfig, isLoading };
}
