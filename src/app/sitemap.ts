import { MetadataRoute } from 'next';
import { adminDb } from '@/lib/firebaseAdmin'; 
import { Timestamp } from 'firebase-admin/firestore'; 
import type { FirestoreCategory, ArtistApplication, FirestoreCity, FirestoreArea, FirestoreBlogPost, ContentPage } from '@/types/firestore';
import { getBaseUrl } from '@/lib/config'; 
import { unstable_cache } from 'next/cache';

export const dynamic = 'force-dynamic'; 
export const revalidate = 86400; // Revalidate sitemap every 24 hours

const safeToISOString = (timestamp: Timestamp | undefined | string | Date, fallbackDate: string): string => {
  try {
    if (timestamp && typeof (timestamp as Timestamp).toDate === 'function') {
      return (timestamp as Timestamp).toDate().toISOString();
    }
    if (typeof timestamp === 'string') {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
    if (timestamp instanceof Date) {
      return timestamp.toISOString();
    }
    return fallbackDate;
  } catch (e) {
    return fallbackDate;
  }
};

export async function getSitemapEntries(): Promise<MetadataRoute.Sitemap> {
  const appBaseUrl = getBaseUrl(); 
  const entries: MetadataRoute.Sitemap = [];
  const currentDate = new Date().toISOString();

  const staticPages = [
    '', '/about-us', '/contact-us', '/careers', '/terms-and-conditions',
    '/privacy-policy', '/faq', '/service-disclaimer', '/cancellation-policy', '/damage-and-claims-policy', 
    '/blog', '/sitemap', '/script-writing',
  ];

  staticPages.forEach(page => {
    entries.push({
      url: `${appBaseUrl}${page}`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: page === '' ? 1.0 : 0.8,
    });
  });

  try {
    const contentPagesSnapshot = await adminDb.collection('contentPages').get();
    contentPagesSnapshot.forEach(docSnap => {
      const pageData = docSnap.data() as ContentPage;
      if (pageData.slug && !staticPages.includes(`/${pageData.slug}`)) {
        entries.push({
          url: `${appBaseUrl}/${pageData.slug}`,
          lastModified: safeToISOString(pageData.updatedAt || pageData.createdAt, currentDate),
          changeFrequency: 'monthly',
          priority: 0.6,
        });
      }
    });
  } catch (e) {
    console.error("Sitemap: Error fetching content pages:", e);
  }

  try {
    const blogSnapshot = await adminDb
      .collection('blogPosts')
      .where('isPublished', '==', true)
      .get();
    blogSnapshot.forEach(docSnap => {
      const blogData = docSnap.data() as FirestoreBlogPost;
      if (blogData.slug) {
        entries.push({
          url: `${appBaseUrl}/blog/${blogData.slug}`,
          lastModified: safeToISOString(blogData.updatedAt || blogData.createdAt, currentDate),
          changeFrequency: 'monthly',
          priority: 0.7,
        });
      }
    });
  } catch (e) {
    console.error("Sitemap: Error fetching blog posts:", e);
  }

  try {
    const categoriesSnapshot = await adminDb.collection('adminCategories').where('isActive', '==', true).get();
    categoriesSnapshot.forEach(docSnap => {
      const categoryData = docSnap.data() as FirestoreCategory;
      if (categoryData.slug) {
        entries.push({
          url: `${appBaseUrl}/category/${categoryData.slug}`,
          lastModified: safeToISOString(categoryData.createdAt, currentDate),
          changeFrequency: 'daily',
          priority: 0.9,
        });
      }
    });
  } catch (e) {
    console.error("Sitemap: Error fetching categories:", e);
  }

  try {
    const artistsSnapshot = await adminDb
      .collection('ArtistApplications')
      .where('status', '==', 'approved')
      .get();

    // Cache categories to avoid redundant reads
    const categorySlugMap: Record<string, string> = {};
    const categoriesSnapshot = await adminDb.collection('adminCategories').get();
    categoriesSnapshot.forEach(doc => {
        categorySlugMap[doc.id] = doc.data().slug;
    });

    artistsSnapshot.forEach(docSnap => {
      const artistData = docSnap.data() as ArtistApplication;
      const username = artistData.username;
      const categorySlug = artistData.workCategorySlug || (artistData.workCategoryId ? categorySlugMap[artistData.workCategoryId] : null);

      if (username && categorySlug) {
        entries.push({
          url: `${appBaseUrl}/category/${categorySlug}/${username}`,
          lastModified: safeToISOString(artistData.updatedAt || artistData.createdAt, currentDate),
          changeFrequency: 'daily',
          priority: 0.8,
        });
      }
    });
  } catch (e) {
    console.error("Sitemap: Error fetching artists:", e);
  }

  try {
    const citiesSnapshot = await adminDb.collection('cities').where('isActive', '==', true).get();
    const citySlugMap: Record<string, string> = {};

    citiesSnapshot.forEach(cityDoc => {
      const city = cityDoc.data() as FirestoreCity;
      if (city.slug) {
        citySlugMap[cityDoc.id] = city.slug;
        entries.push({
          url: `${appBaseUrl}/${city.slug}`,
          lastModified: safeToISOString(city.updatedAt || city.createdAt, currentDate),
          changeFrequency: 'daily',
          priority: 0.9,
        });
      }
    });

    const areasSnapshot = await adminDb.collection('areas').where('isActive', '==', true).get();
    areasSnapshot.forEach(areaDoc => {
      const area = areaDoc.data() as FirestoreArea;
      const citySlug = citySlugMap[area.cityId];
      if (area.slug && citySlug) {
        entries.push({
          url: `${appBaseUrl}/${citySlug}/${area.slug}`,
          lastModified: safeToISOString(area.updatedAt || area.createdAt, currentDate),
          changeFrequency: 'daily',
          priority: 0.8,
        });
      }
    });

    // 1. Fetch only saved and active cityCategorySeoSettings
    const cityCatSeoSnapshot = await adminDb.collection('cityCategorySeoSettings').where('isActive', '==', true).get();
    cityCatSeoSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data.slug) {
        entries.push({
          url: `${appBaseUrl}/${data.slug}`,
          lastModified: safeToISOString(data.updatedAt || data.createdAt, currentDate),
          changeFrequency: 'daily',
          priority: 0.8,
        });
      }
    });

    // 2. Fetch only saved and active areaCategorySeoSettings
    const areaCatSeoSnapshot = await adminDb.collection('areaCategorySeoSettings').where('isActive', '==', true).get();
    areaCatSeoSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data.slug) {
        entries.push({
          url: `${appBaseUrl}/${data.slug}`,
          lastModified: safeToISOString(data.updatedAt || data.createdAt, currentDate),
          changeFrequency: 'daily',
          priority: 0.7,
        });
      }
    });

  } catch (e) {
    console.error("Sitemap: Error fetching cities/areas/categories/overrides:", e);
  }

  const uniqueEntries = Array.from(new Map(entries.map(entry => [entry.url, entry])).values());
  return uniqueEntries;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return unstable_cache(
    async () => {
      try {
        return await getSitemapEntries();
      } catch (error) {
        console.error("SITEMAP_GENERATION_ERROR: Failed to generate sitemap entries:", error);
        const appBaseUrl = getBaseUrl(); 
        return [
          {
            url: appBaseUrl,
            lastModified: new Date().toISOString(),
            changeFrequency: 'yearly' as const,
            priority: 0.1,
          },
        ];
      }
    },
    ['sitemap-data'],
    { 
      revalidate: false, 
      tags: ['sitemap', 'global-cache'] 
    }
  )();
}
