import { MetadataRoute } from 'next';
import { queryDb } from '@/lib/mysql';
import type { FirestoreBlogPost, ContentPage } from '@/types/firestore';
import { getBaseUrl } from '@/lib/config'; 
import { unstable_cache } from 'next/cache';

export const dynamic = 'force-dynamic'; 
export const revalidate = 86400; // Revalidate sitemap every 24 hours

const safeToISOString = (timestamp: any, fallbackDate: string): string => {
  try {
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
    '', '/about-us', '/contact-us', '/terms-and-conditions',
    '/privacy-policy', '/faq', '/cancellation-policy',
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
    const rows = await queryDb<any[]>("SELECT data FROM generic_collections WHERE collection_name = 'contentPages'");
    rows.forEach(row => {
      try {
        const pageData = JSON.parse(row.data) as ContentPage;
        if (pageData.slug && !staticPages.includes(`/${pageData.slug}`)) {
          entries.push({
            url: `${appBaseUrl}/${pageData.slug}`,
            lastModified: safeToISOString(pageData.updatedAt || pageData.createdAt, currentDate),
            changeFrequency: 'monthly',
            priority: 0.6,
          });
        }
      } catch (e) {}
    });
  } catch (e) {
    console.error("Sitemap: Error fetching content pages:", e);
  }

  try {
    const rows = await queryDb<any[]>("SELECT data FROM generic_collections WHERE collection_name = 'blogPosts'");
    rows.forEach(row => {
      try {
        const blogData = JSON.parse(row.data) as FirestoreBlogPost;
        if (blogData.slug && blogData.isPublished) {
          entries.push({
            url: `${appBaseUrl}/blog/${blogData.slug}`,
            lastModified: safeToISOString(blogData.updatedAt || blogData.createdAt, currentDate),
            changeFrequency: 'monthly',
            priority: 0.7,
          });
        }
      } catch (e) {}
    });
  } catch (e) {
    console.error("Sitemap: Error fetching blog posts:", e);
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
