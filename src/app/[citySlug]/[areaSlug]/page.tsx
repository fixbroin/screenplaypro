
import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/firebaseAdmin';
import { getHomepageData, getAggregateRating } from '@/lib/homepageUtils';
import { getBaseUrl } from '@/lib/config';
import { serializeFirestoreData } from '@/lib/serializeUtils';
import type { FirestoreCity, FirestoreArea, FirestoreSEOSettings } from '@/types/firestore';
import HomePageClient from '@/components/home/HomePageClient';
import BreadcrumbSchema from '@/components/shared/BreadcrumbSchema';
import type { Metadata } from 'next';
import { cache } from 'react';
import { unstable_cache } from 'next/cache';

export const dynamic = 'force-dynamic';
export const revalidate = false;

const getCityData = cache(async (slug: string): Promise<FirestoreCity | null> => {
    return unstable_cache(
        async () => {
            try {
                const snapshot = await adminDb.collection('cities').where('slug', '==', slug).where('isActive', '==', true).limit(1).get();
                if (snapshot.empty) return null;
                return { id: snapshot.docs[0].id, ...serializeFirestoreData<any>(snapshot.docs[0].data()) } as FirestoreCity;
            } catch (error) {
                console.error(`Error fetching city data:`, error);
                return null;
            }
        },
        [`city-data-${slug}`],
        { tags: ['cities', `city-${slug}`, 'global-cache'] }
    )();
});

const getAreaData = cache(async (slug: string, cityId: string): Promise<FirestoreArea | null> => {
    return unstable_cache(
        async () => {
            try {
                const snapshot = await adminDb.collection('areas').where('slug', '==', slug).where('cityId', '==', cityId).where('isActive', '==', true).limit(1).get();
                if (snapshot.empty) return null;
                return { id: snapshot.docs[0].id, ...serializeFirestoreData<any>(snapshot.docs[0].data()) } as FirestoreArea;
            } catch (error) {
                console.error(`Error fetching area data:`, error);
                return null;
            }
        },
        [`area-data-${cityId}-${slug}`],
        { tags: ['areas', `area-${slug}`, 'global-cache'] }
    )();
});

export async function generateMetadata(
    { params }: { params: Promise<{ citySlug: string, areaSlug: string }> }
): Promise<Metadata> {
    const { citySlug, areaSlug } = await params;
    const city = await getCityData(citySlug);
    if (!city) return {};
    const area = await getAreaData(areaSlug, city.id);
    if (!area) return {};

    const seoSettingsDoc = await adminDb.collection('seoSettings').doc('global').get();
    const seoSettings = seoSettingsDoc.exists ? serializeFirestoreData<FirestoreSEOSettings>(seoSettingsDoc.data()) : {};
    const appBaseUrl = getBaseUrl();

    const title = area.seo_title || area.metaTitle || (seoSettings.areaPageTitlePattern?.replace(/{{areaName}}/g, area.name).replace(/{{cityName}}/g, city.name)) || `Screenplay Writing in ${area.name}, ${city.name} | Screenplay Pro`;
    const description = area.seo_description || area.metaDescription || (seoSettings.areaPageDescriptionPattern?.replace(/{{areaName}}/g, area.name).replace(/{{cityName}}/g, city.name)) || `Write film scripts and screenplays in ${area.name}, ${city.name} with Screenplay Pro.`;
    const keywords = (area.seo_keywords || area.metaKeywords || (seoSettings.areaPageKeywordsPattern?.replace(/{{areaName}}/g, area.name).replace(/{{cityName}}/g, city.name)) || "").split(',').map(k => k.trim()).filter(k => k);

    return {
        title,
        description,
        keywords: keywords.length > 0 ? keywords : undefined,
        robots: { index: true, follow: true },
        alternates: { canonical: `${appBaseUrl}/${citySlug}/${areaSlug}` },
        openGraph: {
            title,
            description,
            url: `/${citySlug}/${areaSlug}`,
            images: [{ url: `${appBaseUrl}/android-chrome-512x512.png`, width: 512, height: 512 }],
            type: 'website',
        }
    };
}

export default async function AreaHomepage({ params }: { params: Promise<{ citySlug: string, areaSlug: string }> }) {
    const { citySlug, areaSlug } = await params;
    
    const city = await getCityData(citySlug);
    if (!city) notFound();
    const area = await getAreaData(areaSlug, city.id);
    if (!area) notFound();

    const [homepageData, aggregateRating] = await Promise.all([
        getHomepageData(),
        getAggregateRating()
    ]);

    const h1 = area.h1_title || (homepageData.seoSettings.areaPageH1Pattern?.replace(/{{areaName}}/g, area.name).replace(/{{cityName}}/g, city.name)) || `Screenplay Writing in ${area.name}, ${city.name}`;

    const breadcrumbItems = [
        { label: 'Home', href: '/' },
        { label: city.name, href: `/${citySlug}` },
        { label: area.name }
    ];

    return (
        <>
            <BreadcrumbSchema items={breadcrumbItems} />
            <HomePageClient 
                initialData={homepageData} 
                initialH1Title={h1} 
                citySlug={citySlug}
                areaSlug={areaSlug}
                breadcrumbItems={breadcrumbItems}
            />
        </>
    );
}
