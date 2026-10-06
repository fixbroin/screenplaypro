'use server';

import { queryDb } from './mysql';
import type { GlobalWebSettings, ThemePalette, ContentPage } from '@/types/firestore';
import { DEFAULT_LIGHT_THEME_COLORS_HSL, DEFAULT_DARK_THEME_COLORS_HSL, THEME_PALETTE_KEYS } from '@/lib/colorUtils';
import { defaultGlobalWebSettings } from '@/config/webDefaults';
import { defaultAppSettings } from '@/config/appDefaults';
import { defaultMarketingValues } from '@/hooks/useMarketingSettings';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';

import { DEFAULT_CONTENT_PAGES } from '@/config/defaultContent';

/**
 * Fetches a content page by slug from MySQL.
 */
export const getContentPageData = cache(async (slug: string): Promise<ContentPage | null> => {
  return unstable_cache(
    async () => {
      try {
        const rows = await queryDb<any[]>(
          "SELECT data FROM generic_collections WHERE collection_name = 'contentPages' AND id = ?",
          [slug]
        );
        if (rows.length > 0) {
          const parsed = JSON.parse(rows[0].data) as ContentPage;
          if (parsed && parsed.content && !parsed.content.includes("coming soon.")) {
            return parsed;
          }
        }
        const defaultPage = DEFAULT_CONTENT_PAGES[slug];
        if (defaultPage) {
          return { id: slug, ...defaultPage } as ContentPage;
        }
        return null;
      } catch (error) {
        console.error(`Error fetching content page for slug "${slug}" from MySQL:`, error);
        const defaultPage = DEFAULT_CONTENT_PAGES[slug];
        return defaultPage ? ({ id: slug, ...defaultPage } as ContentPage) : null;
      }
    },
    [`content-page-${slug}`],
    { revalidate: false, tags: ['content', `content-${slug}`, 'global-cache'] }
  )();
});

/**
 * Fetches marketing settings from MySQL app_settings.
 */
export const getMarketingSettings = cache(async (): Promise<any> => {
  return unstable_cache(
    async () => {
      try {
        const rows = await queryDb<any[]>(
          "SELECT setting_value FROM app_settings WHERE setting_key = 'marketingConfiguration'"
        );
        if (rows.length > 0) {
          const data = JSON.parse(rows[0].setting_value) || {};
          return {
            ...defaultMarketingValues,
            ...data,
          };
        }
        return defaultMarketingValues;
      } catch (error) {
        console.error('Error fetching marketing settings from MySQL:', error);
        return defaultMarketingValues;
      }
    },
    ['marketing-settings'],
    { 
      revalidate: false, 
      tags: ['marketing-settings', 'global-cache'] 
    }
  )();
});

/**
 * Fetches global app settings from MySQL app_settings.
 */
export const getGlobalAppSettings = cache(async (): Promise<any> => {
  return unstable_cache(
    async () => {
      try {
        const rows = await queryDb<any[]>(
          "SELECT setting_value FROM app_settings WHERE setting_key = 'applicationConfig'"
        );
        if (rows.length > 0) {
          const data = JSON.parse(rows[0].setting_value) || {};
          return {
            ...defaultAppSettings,
            ...data,
          };
        }
        return defaultAppSettings;
      } catch (error) {
        console.error('Error fetching global app settings from MySQL:', error);
        return defaultAppSettings;
      }
    },
    ['global-app-settings'],
    { 
      revalidate: false, 
      tags: ['app-settings', 'global-cache'] 
    }
  )();
});

/**
 * Fetches global web settings from MySQL webSettings table.
 */
export const getGlobalWebSettings = cache(async (): Promise<GlobalWebSettings> => {
  return unstable_cache(
    async () => {
      try {
        const rows = await queryDb<any[]>("SELECT config FROM webSettings WHERE id = 'global'");
        if (rows.length > 0) {
          const data = (typeof rows[0].config === 'string' ? JSON.parse(rows[0].config || '{}') : rows[0].config) as Partial<GlobalWebSettings>;
          
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
            globalAdminPopup: {
              ...defaultGlobalWebSettings.globalAdminPopup,
              ...(data.globalAdminPopup || {}),
            },
          } as GlobalWebSettings;
        }
        return defaultGlobalWebSettings;
      } catch (error) {
        console.error('Error fetching global web settings from MySQL:', error);
        return defaultGlobalWebSettings;
      }
    },
    ['global-web-settings'],
    { 
      revalidate: false, 
      tags: ['web-settings', 'global-cache'] 
    }
  )();
});
