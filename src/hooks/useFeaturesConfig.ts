"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
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

    Promise.all([
      fetch('/api/db/settings?key=featuresConfiguration').then(r => r.json()).catch(() => null),
      fetch('/api/db/settings?key=marketingAutomation').then(r => r.json()).catch(() => null)
    ]).then(([featRes, mktRes]) => {
      const freshFeatures = (featRes && featRes.success && featRes.data)
        ? { ...defaultFeaturesConfig, ...featRes.data }
        : defaultFeaturesConfig;
      const freshMarketing = (mktRes && mktRes.success && mktRes.data)
        ? mktRes.data
        : null;

      setFeaturesConfig(freshFeatures);
      setMarketingConfig(freshMarketing);
      setCache(CACHE_KEY, { features: freshFeatures, marketing: freshMarketing }, true);
      setIsLoading(false);
    }).catch(err => {
      console.error("Error fetching features/marketing config from MySQL:", err);
      setIsLoading(false);
    });
  }, []);

  return { featuresConfig, config: featuresConfig, marketingConfig, isLoading };
}
