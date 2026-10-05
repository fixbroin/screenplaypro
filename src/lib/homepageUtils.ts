// src/lib/homepageUtils.ts
'use server';

import { queryDb } from './mysql';
import type { 
    FeaturesConfiguration, 
    GlobalWebSettings, 
    FirestoreCity, 
    FirestoreArea, 
    FirestoreSEOSettings,
    FirestoreCategory,
    FirestoreSubCategory,
    FirestoreService,
    ArtistApplication
} from '@/types/firestore';
import { unstable_cache } from 'next/cache';
import { cache } from 'react';

export interface HomepageData {
    featuresConfig: FeaturesConfiguration;
    popularArtists: ArtistApplication[];
    recentArtists: ArtistApplication[];
    categoriesWithArtists: Array<{
        categoryId: string;
        categoryName: string;
        categorySlug: string;
        artists: ArtistApplication[];
    }>;
    seoSettings: FirestoreSEOSettings;
    webSettings: GlobalWebSettings | null;
    citiesWithAreas: Array<FirestoreCity & { areas: FirestoreArea[] }>;
    allCategories: FirestoreCategory[];
}

export const getHomepageData = cache(async (): Promise<HomepageData> => {
    const fetchFunc = async () => {
        try {
            const [featRows, seoRows, webRows] = await Promise.all([
                queryDb<any[]>("SELECT setting_value FROM app_settings WHERE setting_key = 'featuresConfiguration'").catch(() => []),
                queryDb<any[]>("SELECT setting_value FROM app_settings WHERE setting_key = 'seoConfiguration'").catch(() => []),
                queryDb<any[]>("SELECT config FROM webSettings WHERE id = 'global'").catch(() => [])
            ]);

            const featuresConfig = featRows.length > 0
                ? (JSON.parse(featRows[0].setting_value) as FeaturesConfiguration)
                : {
                    showMostPopularServices: true,
                    showRecentlyAddedServices: true,
                    showCategoryWiseServices: true,
                    showBlogSection: true,
                    showCustomServiceButton: false,
                    homepageCategoryVisibility: {},
                    ads: [],
                } as FeaturesConfiguration;

            const seoSettings = seoRows.length > 0
                ? (JSON.parse(seoRows[0].setting_value) as FirestoreSEOSettings)
                : {} as FirestoreSEOSettings;

            const webSettings = webRows.length > 0
                ? (typeof webRows[0].config === 'string' ? JSON.parse(webRows[0].config) : webRows[0].config)
                : null;

            return {
                featuresConfig,
                popularArtists: [],
                recentArtists: [],
                categoriesWithArtists: [],
                seoSettings,
                webSettings,
                citiesWithAreas: [],
                allCategories: []
            };
        } catch (error) {
            console.error("Error in getHomepageData:", error);
            return {
                featuresConfig: {
                    showMostPopularServices: true,
                    showRecentlyAddedServices: true,
                    showCategoryWiseServices: true,
                    showBlogSection: true,
                    showCustomServiceButton: false,
                    homepageCategoryVisibility: {},
                    ads: [],
                },
                popularArtists: [],
                recentArtists: [],
                categoriesWithArtists: [],
                seoSettings: {} as FirestoreSEOSettings,
                webSettings: null,
                citiesWithAreas: [],
                allCategories: []
            };
        }
    };

    if (process.env.NODE_ENV === 'development') {
        return fetchFunc();
    }

    return unstable_cache(
        fetchFunc,
        ['homepage-data'],
        { revalidate: false, tags: ['global', 'cities', 'categories', 'artists', 'global-cache'] }
    )();
});

export interface FullCategoryData {
    category: FirestoreCategory;
    subCategories: Array<FirestoreSubCategory & { services: FirestoreService[] }>;
    artists: ArtistApplication[];
    seoSettings: FirestoreSEOSettings;
}

export const getCategoryFullData = cache(async (categorySlug: string): Promise<FullCategoryData | null> => {
    return null;
});

export const getCategoryArtists = cache(async (categoryId: string, cityId?: string, areaId?: string): Promise<ArtistApplication[]> => {
    return [];
});

export const getAggregateRating = cache(async (): Promise<{ ratingValue: string, reviewCount: number } | null> => {
    return null;
});
