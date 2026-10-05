// src/lib/seoServerUtils.ts
'use server';

import { queryDb } from './mysql';
import { defaultSeoValues } from './seoUtils';
import type { FirestoreSEOSettings } from '@/types/firestore';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';

/**
 * Fetches global SEO settings from MySQL app_settings.
 * Safe to call from Server Components or Server Actions.
 */
export const getGlobalSEOSettings = cache(async (): Promise<FirestoreSEOSettings> => {
  return unstable_cache(
    async () => {
      try {
        const rows = await queryDb<any[]>(
          "SELECT setting_value FROM app_settings WHERE setting_key = 'seoConfiguration'"
        );
        if (rows.length > 0) {
          const data = JSON.parse(rows[0].setting_value) || {};
          return { ...defaultSeoValues, ...data };
        }
        return defaultSeoValues;
      } catch (error) {
        console.error('Error fetching global SEO settings from MySQL:', error);
        return defaultSeoValues;
      }
    },
    ['global-seo-settings'],
    { 
      revalidate: false, 
      tags: ['seo-settings', 'global-cache'] 
    }
  )();
});
