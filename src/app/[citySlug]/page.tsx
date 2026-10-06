import { notFound } from 'next/navigation';
import { queryDb } from '@/lib/mysql';
import { getHomepageData, getAggregateRating } from '@/lib/homepageUtils';
import { getBaseUrl } from '@/lib/config';
import type { FirestoreCity } from '@/types/firestore';
import HomePageClient from '@/components/home/HomePageClient';
import BreadcrumbSchema from '@/components/shared/BreadcrumbSchema';
import type { Metadata } from 'next';
import { cache } from 'react';
import { getGlobalSEOSettings } from '@/lib/seoServerUtils';

export const dynamic = 'force-dynamic';
export const revalidate = false;

const getCityData = cache(async (slug: string): Promise<FirestoreCity | null> => {
    try {
        const rows = await queryDb<any[]>(
            "SELECT id, data FROM generic_collections WHERE collection_name = 'cities'"
        );
        for (const row of rows) {
            try {
                const data = JSON.parse(row.data);
                if (data.slug === slug && data.isActive !== false) {
                    return { id: row.id, ...data } as FirestoreCity;
                }
            } catch (e) {}
        }
        return null;
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

    const seoSettings = await getGlobalSEOSettings();
    const appBaseUrl = getBaseUrl();

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
            type: 'website',
        }
    };
}

export default async function CityLandingPage({ params }: { params: Promise<{ citySlug: string }> }) {
    const { citySlug } = await params;
    const city = await getCityData(citySlug);

    if (!city) {
        notFound();
    }

    const [homepageData] = await Promise.all([
        getHomepageData(),
        getAggregateRating()
    ]);

    const cityH1 = city.h1_title || `Screenplay Writing & Scriptwriters in ${city.name}`;

    return (
        <>
            <BreadcrumbSchema items={[{ label: 'Home', href: '/' }, { label: city.name, href: `/${citySlug}` }]} />
            <HomePageClient initialData={homepageData} initialH1Title={cityH1} />
        </>
    );
}
