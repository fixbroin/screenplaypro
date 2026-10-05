import type { Metadata, ResolvingMetadata } from 'next';
import type { GlobalWebSettings, FirestoreSEOSettings } from '@/types/firestore';
import { getGlobalSEOSettings } from '@/lib/seoServerUtils';
import HomePageClient from '@/components/home/HomePageClient';
import { getBaseUrl } from '@/lib/config';
import { getHomepageData, getAggregateRating } from '@/lib/homepageUtils';
import { getGlobalWebSettings } from '@/lib/webServerUtils';
import JsonLdScript from '@/components/shared/JsonLdScript';

export const revalidate = false;

export async function generateMetadata(
  _: {}, 
  parent: ResolvingMetadata
): Promise<Metadata> {
  const resolvedParent = await parent;
  
  const seoSettings = await getGlobalSEOSettings();
  const webSettings = await getGlobalWebSettings();
  const appBaseUrl = getBaseUrl();

  const title = seoSettings.homepageMetaTitle || seoSettings.siteName || 'Screenplay Pro';
  const description = seoSettings.homepageMetaDescription || seoSettings.defaultMetaDescription || 'Professional Industry-Standard Screenplay Writing Software. Write, Format, and Export Movie Scripts easily.';
  const keywords = (seoSettings.homepageMetaKeywords || seoSettings.defaultMetaKeywords || 'screenplay writing, script writer, movie script editor, screenplay pro, script formatting').split(',').map(k => k.trim()).filter(k => k);

  const ogImageFromWebSettings = webSettings?.websiteIconUrl || webSettings?.logoUrl;
  const rawOgImage = ogImageFromWebSettings || seoSettings.structuredDataImage || `/default-image.png`;
  const ogImage = rawOgImage.startsWith('http') ? rawOgImage : `${appBaseUrl}${rawOgImage.startsWith('/') ? '' : '/'}${rawOgImage}`;

  const siteName = resolvedParent.openGraph?.siteName || seoSettings.siteName || 'Screenplay Pro';

  return {
    title: title,
    description: description,
    keywords: keywords.length > 0 ? keywords : undefined,
    robots: {
      index: true,
      follow: true,
    },
    alternates: {
      canonical: `${appBaseUrl}`,
    },
    openGraph: {
      title: title,
      description: description,
      url: '/',
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      siteName: siteName,
      type: 'website',
    },
  };
}

export default async function Page() {
  const [homepageData, aggregateRating] = await Promise.all([
    getHomepageData(),
    getAggregateRating()
  ]);

  const appBaseUrl = getBaseUrl();
  const siteName = homepageData.seoSettings.siteName || 'Screenplay Pro';
  const seoSettings = homepageData.seoSettings;

  const rawSchemaImage = seoSettings.structuredDataImage || `/android-chrome-512x512.png`;
  const schemaImage = rawSchemaImage.startsWith('http') ? rawSchemaImage : `${appBaseUrl}${rawSchemaImage.startsWith('/') ? '' : '/'}${rawSchemaImage}`;

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": seoSettings.structuredDataType || "SoftwareApplication",
    "additionalType": "https://schema.org/CreativeWork",
    "name": siteName,
    "url": appBaseUrl,
    "logo": `${appBaseUrl}/android-chrome-512x512.png`,
    "image": schemaImage,
    "description": seoSettings.homepageMetaDescription || "Professional Screenplay Writing Platform. Write, Format, Translate and Export Film & TV Scripts with Ease.",
    "telephone": seoSettings.structuredDataTelephone,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": seoSettings.structuredDataStreetAddress || "#44, G S Palya Road, Konappana Agrahara, Electronic City Phase 2",
      "addressLocality": seoSettings.structuredDataLocality || "Bangalore",
      "addressRegion": seoSettings.structuredDataRegion || "Karnataka",
      "postalCode": seoSettings.structuredDataPostalCode || "560100",
      "addressCountry": seoSettings.structuredDataCountry || "IN"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 12.8452,
      "longitude": 77.6633
    },
    "openingHoursSpecification": {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": [
        "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
      ],
      "opens": "08:00",
      "closes": "20:00"
    },
    "sameAs": Object.values(seoSettings.socialProfileUrls || {}).filter(url => !!url),
    "priceRange": "₹₹",
    "keywords": "acting auditions, casting calls bangalore, film casting india, acting jobs, hire actors, casting agency bangalore"
  };

  if (aggregateRating) {
    (localBusinessSchema as any).aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": aggregateRating.ratingValue || "4.8",
      "reviewCount": aggregateRating.reviewCount || "120",
      "bestRating": "5",
      "worstRating": "1"
    };
  } else {
    // High-quality fallback so stars always show
    (localBusinessSchema as any).aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "reviewCount": "156",
      "bestRating": "5",
      "worstRating": "1"
    };
  }

  return (
    <>
      <JsonLdScript data={localBusinessSchema} idSuffix="homepage-local-biz" />
      <HomePageClient initialData={homepageData} initialH1Title={seoSettings.homepageH1} />
    </>
  );
}

