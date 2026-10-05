
import { notFound } from 'next/navigation';
import { adminDb } from '@/lib/firebaseAdmin';
import { getHomepageData, getAggregateRating } from '@/lib/homepageUtils';
import { getBaseUrl } from '@/lib/config';
import { serializeFirestoreData } from '@/lib/serializeUtils';
import type { FirestoreCity, FirestoreSEOSettings } from '@/types/firestore';
import HomePageClient from '@/components/home/HomePageClient';
import JsonLdScript from '@/components/shared/JsonLdScript';
import BreadcrumbSchema from '@/components/shared/BreadcrumbSchema';
import type { Metadata, ResolvingMetadata } from 'next';
import { cache } from 'react';

export const dynamic = 'force-dynamic';
export const revalidate = false;

const getCityData = cache(async (slug: string): Promise<FirestoreCity | null> => {
    try {
        const snapshot = await adminDb.collection('cities')
            .where('slug', '==', slug)
            .where('isActive', '==', true)
            .limit(1)
            .get();
        if (snapshot.empty) return null;
        return { id: snapshot.docs[0].id, ...serializeFirestoreData<any>(snapshot.docs[0].data()) } as FirestoreCity;
    } catch (error) {
        console.error(`Error fetching city data for slug ${slug}:`, error);
        return null;
    }
});

export async function generateMetadata(
    { params }: { params: Promise<{ citySlug: string }> }
): Promise<Metadata> {
    const { citySlug } = await params;
    const city = await getCityData(citySlug);
    if (!city) return {};

    const seoSettingsDoc = await adminDb.collection('seoSettings').doc('global').get();
    const seoSettings = seoSettingsDoc.exists ? serializeFirestoreData<FirestoreSEOSettings>(seoSettingsDoc.data()) : {};
    const appBaseUrl = getBaseUrl();

    // Use city specific SEO or global pattern
    const title = city.seo_title || city.metaTitle || (seoSettings.cityPageTitlePattern?.replace(/{{cityName}}/g, city.name)) || `${city.name} Screenplay Writing | Screenplay Pro`;
    const description = city.seo_description || city.metaDescription || (seoSettings.cityPageDescriptionPattern?.replace(/{{cityName}}/g, city.name)) || `Write and format professional screenplays in ${city.name} with Screenplay Pro.`;
    const keywords = (city.seo_keywords || city.metaKeywords || (seoSettings.cityPageKeywordsPattern?.replace(/{{cityName}}/g, city.name)) || "").split(',').map(k => k.trim()).filter(k => k);

    return {
        title,
        description,
        keywords: keywords.length > 0 ? keywords : undefined,
        robots: {
            index: true,
            follow: true,
        },
        alternates: { canonical: `${appBaseUrl}/${citySlug}` },
        openGraph: {
            title,
            description,
            url: `/${citySlug}`,
            images: [{ url: `${appBaseUrl}/android-chrome-512x512.png`, width: 512, height: 512 }],
            type: 'website',
        }
    };
}

export default async function CityHomepage({ params }: { params: Promise<{ citySlug: string }> }) {
    const { citySlug } = await params;
    
    const city = await getCityData(citySlug);
    if (!city) {
        notFound();
    }

    const [homepageData, aggregateRating] = await Promise.all([
        getHomepageData(),
        getAggregateRating()
    ]);

    const h1 = city.h1_title || (homepageData.seoSettings.cityPageH1Pattern?.replace(/{{cityName}}/g, city.name)) || `Screenplay Writing in ${city.name}`;

    const breadcrumbItems = [
        { label: 'Home', href: '/' },
        { label: city.name }
    ];

    return (
        <>
            <BreadcrumbSchema items={breadcrumbItems} />
            <HomePageClient 
                initialData={homepageData} 
                initialH1Title={h1} 
                citySlug={citySlug}
                breadcrumbItems={breadcrumbItems}
            />
        </>
    );
}
