"use client";

import { useState, useEffect, useRef } from 'react';
import type { GlobalWebSettings, ThemePalette, GlobalAdminPopup } from '@/types/firestore';
import { DEFAULT_LIGHT_THEME_COLORS_HSL, DEFAULT_DARK_THEME_COLORS_HSL, THEME_PALETTE_KEYS } from '@/lib/colorUtils';
import { defaultGlobalWebSettings } from '@/config/webDefaults';
import { getCache, setCache } from '@/lib/client-cache';
import { usePathname } from 'next/navigation';

const CACHE_KEY = "global-web-settings";

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

const processSettingsData = (data: Partial<GlobalWebSettings>): GlobalWebSettings => {
  const mergedLightPalette: Required<ThemePalette> = { ...DEFAULT_LIGHT_THEME_COLORS_HSL };
  THEME_PALETTE_KEYS.forEach(key => {
    if (data.themeColors?.light?.[key]) {
      (mergedLightPalette[key] as any) = data.themeColors.light[key];
    }
  });

  const mergedDarkPalette: Required<ThemePalette> = { ...DEFAULT_DARK_THEME_COLORS_HSL };
  THEME_PALETTE_KEYS.forEach(key => {
    if (data.themeColors?.dark?.[key]) {
      (mergedDarkPalette[key] as any) = data.themeColors.dark[key];
    }
  });

  const globalAdminPopup = {
    ...defaultGlobalWebSettings.globalAdminPopup,
    ...(data.globalAdminPopup || {}),
  } as GlobalAdminPopup;

  return {
    ...defaultGlobalWebSettings,
    ...data,
    themeColors: {
      light: mergedLightPalette,
      dark: mergedDarkPalette,
    },
    socialMediaLinks: {
      ...defaultGlobalWebSettings.socialMediaLinks,
      ...(data.socialMediaLinks || {}),
    },
    globalAdminPopup,
  };
};

export function useGlobalSettings() {
  const [settings, setSettings] = useState<GlobalWebSettings>(() => {
    const cached = getCache<GlobalWebSettings>(CACHE_KEY, true);
    return cached ? processSettingsData(cached) : defaultGlobalWebSettings;
  });
  const [isLoading, setIsLoading] = useState(!getCache(CACHE_KEY, true));
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();
  const hasLoadedRef = useRef(false);
  const isVisitorBot = useRef(isBot());

  const fetchSettings = () => {
    if (isVisitorBot.current) {
      setIsLoading(false);
      return;
    }

    // Fetch from MySQL API
    fetch('/api/db/web-settings')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.settings && Object.keys(data.settings).length > 0) {
          const processed = processSettingsData(data.settings);
          setSettings(processed);
          setCache(CACHE_KEY, processed, true);
        }
        setIsLoading(false);
        hasLoadedRef.current = true;
      })
      .catch((err) => {
        console.error("Error fetching web settings from MySQL:", err);
        setError("Failed to load settings.");
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return { settings, isLoading, error, reloadSettings: fetchSettings, refetchSettings: fetchSettings };
}
