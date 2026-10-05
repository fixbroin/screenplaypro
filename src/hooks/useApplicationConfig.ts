"use client";

import { useState, useEffect, useCallback } from 'react';
import type { AppSettings } from '@/types/firestore';
import { defaultAppSettings } from '@/config/appDefaults';
import { getCache, setCache } from '@/lib/client-cache';
import { usePathname } from 'next/navigation';

const APP_CONFIG_COLLECTION = "webSettings";
const APP_CONFIG_DOC_ID = "applicationConfig";
const CACHE_KEY = "app-config";

interface UseApplicationConfigReturn {
  config: AppSettings;
  isLoading: boolean;
  error: string | null;
}

export function useApplicationConfig(): UseApplicationConfigReturn {
  const [config, setConfig] = useState<AppSettings>(() => getCache<AppSettings>(CACHE_KEY, true) || defaultAppSettings);
  const [isLoading, setIsLoading] = useState(!getCache(CACHE_KEY, true));
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');

  const processData = useCallback((firestoreData: Partial<AppSettings>): AppSettings => {
    return {
      ...defaultAppSettings,
      ...firestoreData,
      timeSlotSettings: {
        ...defaultAppSettings.timeSlotSettings,
        ...(firestoreData.timeSlotSettings || {}),
        weeklyAvailability: {
          ...defaultAppSettings.timeSlotSettings.weeklyAvailability,
          ...(firestoreData.timeSlotSettings?.weeklyAvailability || {}),
        }
      },
      platformFees: firestoreData.platformFees || defaultAppSettings.platformFees || [],
      enableCancellationPolicy: typeof firestoreData.enableCancellationPolicy === 'boolean' ? firestoreData.enableCancellationPolicy : defaultAppSettings.enableCancellationPolicy,
      isArtistRegistrationEnabled: typeof firestoreData.isArtistRegistrationEnabled === 'boolean' ? firestoreData.isArtistRegistrationEnabled : defaultAppSettings.isArtistRegistrationEnabled,
      allowUsernameEdit: typeof firestoreData.allowUsernameEdit === 'boolean' ? firestoreData.allowUsernameEdit : defaultAppSettings.allowUsernameEdit,
      enableEmailPasswordLogin: typeof firestoreData.enableEmailPasswordLogin === 'boolean' ? firestoreData.enableEmailPasswordLogin : defaultAppSettings.enableEmailPasswordLogin,
      enableOtpLogin: typeof firestoreData.enableOtpLogin === 'boolean' ? firestoreData.enableOtpLogin : defaultAppSettings.enableOtpLogin,
      enableGoogleLogin: typeof firestoreData.enableGoogleLogin === 'boolean' ? firestoreData.enableGoogleLogin : defaultAppSettings.enableGoogleLogin,
      isReferralSystemEnabled: typeof firestoreData.isReferralSystemEnabled === 'boolean' ? firestoreData.isReferralSystemEnabled : defaultAppSettings.isReferralSystemEnabled,
    };
  }, []);

  useEffect(() => {
    fetch('/api/db/settings?key=applicationConfig')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          const processed = processData(data.data);
          setConfig(processed);
          setCache(CACHE_KEY, processed, true);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching config from MySQL:", err);
        setIsLoading(false);
      });
  }, [processData]);

  return { config, isLoading, error };
}

