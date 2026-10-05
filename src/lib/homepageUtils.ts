// src/lib/homepageUtils.ts
'use server';

import { adminDb } from './firebaseAdmin';
import type { 
    FeaturesConfiguration, 
    FirestoreService, 
    FirestoreCategory, 
    GlobalWebSettings, 
    FirestoreCity, 
    FirestoreArea, 
    FirestoreSEOSettings,
    FirestoreSubCategory,
    ArtistApplication
} from '@/types/firestore';
import { serializeFirestoreData } from './serializeUtils';
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
                // Fetch Features Configuration, Global Settings, Cities, and ALL Categories in parallel
                const [featuresConfigDoc, seoSettingsDoc, webSettingsDoc, citiesSnapshot, allCatsSnapshot] = await Promise.all([
                    adminDb.collection('webSettings').doc('featuresConfiguration').get(),
                    adminDb.collection('seoSettings').doc('global').get(),
                    adminDb.collection('webSettings').doc('global').get(),
                    adminDb.collection('cities').where('isActive', '==', true).orderBy('name').get(),
                    adminDb.collection('adminCategories').where('isActive', '==', true).orderBy('order', 'asc').get()
                ]);

                const featuresConfig = featuresConfigDoc.exists 
                    ? serializeFirestoreData<FeaturesConfiguration>(featuresConfigDoc.data())
                    : {
                        showMostPopularServices: true,
                        showRecentlyAddedServices: true,
                        showCategoryWiseServices: true,
                        showBlogSection: true,
                        showCustomServiceButton: false,
                        homepageCategoryVisibility: {},
                        ads: [],
                    } as FeaturesConfiguration;

                const seoSettings = seoSettingsDoc.exists
                    ? serializeFirestoreData<FirestoreSEOSettings>(seoSettingsDoc.data())
                    : {} as FirestoreSEOSettings;

                const webSettings = webSettingsDoc.exists
                    ? serializeFirestoreData<GlobalWebSettings>(webSettingsDoc.data())
                    : null;

                const allCategories = allCatsSnapshot.docs.map(doc => ({ ...serializeFirestoreData<any>(doc.data()), id: doc.id } as FirestoreCategory));

                const categoryMap = allCategories.reduce((acc, cat) => {
                    acc[cat.id] = cat;
                    return acc;
                }, {} as Record<string, FirestoreCategory>);

                const citiesData = citiesSnapshot.docs.map(doc => ({ ...serializeFirestoreData<any>(doc.data()), id: doc.id } as FirestoreCity));
                
                const citiesWithAreasPromise = Promise.all(citiesData.map(async (city) => {
                    const areasSnapshot = await adminDb.collection('areas')
                        .where('cityId', '==', city.id)
                        .where('isActive', '==', true)
                        .orderBy('name')
                        .get();
                    const areasData = areasSnapshot.docs.map(doc => ({ ...serializeFirestoreData<any>(doc.data()), id: doc.id } as FirestoreArea));
                    return { ...city, areas: areasData };
                }));

                const promises: Promise<any>[] = [];

                // Helper to sort and enrich artists
                const processArtists = (artists: ArtistApplication[]) => {
                    const enriched = artists.map(artist => {
                        if (artist.workCategoryId) {
                            const cat = categoryMap[artist.workCategoryId];
                            if (cat) {
                                // Always prioritize the actual category's current slug/name 
                                // to ensure "Smart Cache" behavior if category URLs change.
                                artist.workCategorySlug = cat.slug;
                                artist.workCategoryName = cat.name;
                            }
                        }
                        return artist;
                    });

                    return enriched.sort((a, b) => {
                        const aIndex = a.promotionIndex ?? 1000;
                        const bIndex = b.promotionIndex ?? 1000;
                        if (aIndex !== bIndex) return aIndex - bIndex;
                        const aTime = a.updatedAt ? new Date(a.updatedAt as any).getTime() : 0;
                        const bTime = b.updatedAt ? new Date(b.updatedAt as any).getTime() : 0;
                        return bTime - aTime;
                    });
                };

                const [citiesWithAreas] = await Promise.all([
                    citiesWithAreasPromise
                ]);

                return {
                    featuresConfig,
                    popularArtists: [],
                    recentArtists: [],
                    categoriesWithArtists: [],
                    seoSettings,
                    webSettings,
                    citiesWithAreas,
                    allCategories
                };

            } catch (error) {
                console.error("Error in getHomepageData:", error);
                throw error;
            }
    };

    if (process.env.NODE_ENV === 'development') {
        return fetchFunc();
    }

    return unstable_cache(
        fetchFunc,
        ['homepage-data'],
        { revalidate: false,
          tags: ['global', 'cities', 'categories', 'artists', 'global-cache'] }
    )();
});

export interface FullCategoryData {
    category: FirestoreCategory;
    subCategories: Array<FirestoreSubCategory & { services: FirestoreService[] }>;
    artists: ArtistApplication[];
    seoSettings: FirestoreSEOSettings;
}

export const getCategoryFullData = cache(async (categorySlug: string): Promise<FullCategoryData | null> => {
    const fetchFunc = async () => {
            try {
                const [categorySnapshot, seoSettingsDoc] = await Promise.all([
                    adminDb.collection('adminCategories')
                        .where('slug', '==', categorySlug)
                        .where('isActive', '==', true)
                        .limit(1)
                        .get(),
                    adminDb.collection('seoSettings').doc('global').get()
                ]);

                if (categorySnapshot.empty) return null;

                const categoryDoc = categorySnapshot.docs[0];
                const category = { id: categoryDoc.id, ...serializeFirestoreData<any>(categoryDoc.data()) } as FirestoreCategory;

                const seoSettings = seoSettingsDoc.exists
                    ? serializeFirestoreData<FirestoreSEOSettings>(seoSettingsDoc.data())
                    : {} as FirestoreSEOSettings;

                const [subCategoriesSnapshot, artistsSnapshot] = await Promise.all([
                    adminDb.collection('adminSubCategories')
                        .where('parentId', '==', category.id)
                        .where('isActive', '==', true)
                        .orderBy('order', 'asc')
                        .get(),
                    adminDb.collection('ArtistApplications')
                        .where('workCategoryId', '==', category.id)
                        .where('status', '==', 'approved')
                        .get()
                ]);

                const subCategories = subCategoriesSnapshot.docs.map(doc => ({ 
                    id: doc.id, 
                    ...serializeFirestoreData<any>(doc.data()) 
                } as FirestoreSubCategory));

                const artists = artistsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...serializeFirestoreData<any>(doc.data())
                } as ArtistApplication)).sort((a, b) => {
                    const aIndex = a.promotionIndex ?? 1000;
                    const bIndex = b.promotionIndex ?? 1000;
                    if (aIndex !== bIndex) return aIndex - bIndex;
                    const aTime = a.updatedAt ? new Date(a.updatedAt as any).getTime() : 0;
                    const bTime = b.updatedAt ? new Date(b.updatedAt as any).getTime() : 0;
                    return bTime - aTime;
                });

                const subCategoriesWithServices = await Promise.all(subCategories.map(async (subCat) => {
                    const servicesSnapshot = await adminDb.collection('adminServices')
                        .where('subCategoryId', '==', subCat.id)
                        .where('isActive', '==', true)
                        .orderBy('name', 'asc')
                        .get();
                    
                    const services = servicesSnapshot.docs.map(doc => ({ 
                        id: doc.id, 
                        ...serializeFirestoreData<any>(doc.data()) 
                    } as FirestoreService));

                    return { ...subCat, services };
                }));

                return {
                    category,
                    subCategories: subCategoriesWithServices,
                    artists,
                    seoSettings
                };
            } catch (error) {
                console.error(`Error in getCategoryFullData for slug ${categorySlug}:`, error);
                return null;
            }
    };

    if (process.env.NODE_ENV === 'development') {
        return fetchFunc();
    }

    return unstable_cache(
        fetchFunc,
        [`category-data-${categorySlug}`],
        { revalidate: false,
          tags: ['categories', 'services', 'artists', `category-${categorySlug}`, 'global-cache'] }
    )();
});

export const getCategoryArtists = cache(async (categoryId: string, cityId?: string, areaId?: string): Promise<ArtistApplication[]> => {
    return unstable_cache(
        async () => {
            try {
                let q = adminDb.collection('ArtistApplications')
                    .where('workCategoryId', '==', categoryId)
                    .where('status', '==', 'approved');
                
                if (cityId) {
                    q = q.where('city', '==', cityId); // Assuming city field in ArtistApplications stores city ID or name
                }
                if (areaId) {
                    q = q.where('area', '==', areaId);
                }

                const snapshot = await q.get();
                return snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...serializeFirestoreData<any>(doc.data())
                } as ArtistApplication));
            } catch (error) {
                console.error("Error fetching category artists:", error);
                return [];
            }
        },
        [`category-artists-${categoryId}-${cityId || 'any'}-${areaId || 'any'}`],
        { revalidate: false, tags: ['artists', 'global-cache'] }
    )();
});

export const getAggregateRating = cache(async (): Promise<{ ratingValue: string, reviewCount: number } | null> => {
    return unstable_cache(
        async () => {
            try {
                // Read from pre-calculated stats to save massive reads
                const statsDoc = await adminDb.collection('appConfiguration').doc('stats').get();
                if (statsDoc.exists) {
                    const data = statsDoc.data();
                    if (data?.ratingValue && data?.reviewCount) {
                        return {
                            ratingValue: String(data.ratingValue),
                            reviewCount: Number(data.reviewCount)
                        };
                    }
                }

                // Fallback to calculation ONLY if stats doc doesn't have it
                const snapshot = await adminDb.collection('adminServices')
                    .where('isActive', '==', true)
                    .where('rating', '>', 0)
                    .get();

                if (snapshot.empty) return null;

                let totalRating = 0;
                let totalReviews = 0;

                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.rating && data.reviewCount) {
                        totalRating += (data.rating * data.reviewCount);
                        totalReviews += data.reviewCount;
                    }
                });

                if (totalReviews === 0) return null;

                return {
                    ratingValue: (totalRating / totalReviews).toFixed(1),
                    reviewCount: totalReviews
                };
            } catch (error) {
                console.error("Error calculating aggregate rating:", error);
                return null;
            }
        },
        ['aggregate-rating'],
        { revalidate: false,
 tags: ['services', 'global-cache'] }
    )();
});
