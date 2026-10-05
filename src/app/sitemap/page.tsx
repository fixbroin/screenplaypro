import { queryDb } from '@/lib/mysql';
import type { 
  FirestoreCategory, FirestoreCity, FirestoreArea, FirestoreBlogPost, 
  ContentPage, ArtistApplication, CityCategorySeoSetting, AreaCategorySeoSetting 
} from '@/types/firestore';
import Link from 'next/link';

import { Metadata } from 'next';
import { getBaseUrl } from '@/lib/config';
import { FileText, Layers, BookOpen, ChevronRight, MapPin, Users, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { unstable_cache } from 'next/cache';
import { cache } from 'react';

export const revalidate = false;

export const metadata: Metadata = {
  title: 'Sitemap - Screenplay Pro',
  description: 'Explore all pages and screenwriting guides on Screenplay Pro.',
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: `${getBaseUrl()}/sitemap`,
  }
};

interface SitemapData {
  pages: Array<{ name: string; url: string }>;
  cities: FirestoreCity[];
  categories: FirestoreCategory[];
  areas: FirestoreArea[];
  cityCategoryOverrides: CityCategorySeoSetting[];
  areaCategoryOverrides: AreaCategorySeoSetting[];
  artists: ArtistApplication[];
  blogs: FirestoreBlogPost[];
}

const getSitemapData = cache(async (): Promise<SitemapData> => {
  return unstable_cache(
    async () => {
      const staticPages = [
        { name: 'Home', url: '/' },
        { name: 'About Us', url: '/about-us' },
        { name: 'Contact Us', url: '/contact-us' },
        { name: 'All Categories', url: '/categories' },
        { name: 'FAQ', url: '/faq' },
        { name: 'Blog', url: '/blog' },
      ];
      
      const contentRows = await queryDb<any[]>(
        "SELECT id, data FROM generic_collections WHERE collection_name = 'contentPages'"
      ).catch(() => []);

      const dynamicContentPages = contentRows.map(row => {
          let data: any = {};
          try { data = JSON.parse(row.data); } catch(e) {}
          return { name: data.title || row.id, url: `/${row.id}`};
      }).filter(page => !staticPages.some(p => p.url === page.url));

      const [
        citiesRows,
        categoriesRows,
        areasRows,
        blogsRows
      ] = await Promise.all([
        queryDb<any[]>("SELECT id, data FROM generic_collections WHERE collection_name = 'cities'").catch(() => []),
        queryDb<any[]>("SELECT id, data FROM generic_collections WHERE collection_name = 'adminCategories'").catch(() => []),
        queryDb<any[]>("SELECT id, data FROM generic_collections WHERE collection_name = 'areas'").catch(() => []),
        queryDb<any[]>("SELECT id, data FROM generic_collections WHERE collection_name = 'blogPosts'").catch(() => []),
      ]);

      const parseRows = (rows: any[]) => rows.map(row => {
        let data: any = {};
        try { data = JSON.parse(row.data); } catch(e) {}
        return { id: row.id, ...data };
      });

      const cities = parseRows(citiesRows).filter((c: any) => c.isActive !== false);
      const categories = parseRows(categoriesRows).filter((c: any) => c.isActive !== false);
      const areas = parseRows(areasRows).filter((a: any) => a.isActive !== false);
      const cityCategoryOverrides: CityCategorySeoSetting[] = [];
      const areaCategoryOverrides: AreaCategorySeoSetting[] = [];
      const artists: ArtistApplication[] = [];
      const blogs = parseRows(blogsRows).filter((b: any) => b.isPublished === true);

      return {
        pages: [...staticPages, ...dynamicContentPages],
        cities,
        categories,
        areas,
        cityCategoryOverrides,
        areaCategoryOverrides,
        artists,
        blogs,
      };
    },
    ['visual-sitemap-data'],
    { 
      revalidate: false, 
      tags: ['sitemap', 'cities', 'categories', 'areas', 'artists', 'blog', 'global-cache'] 
    }
  )();
});


export default async function SitemapPage() {
  const data = await getSitemapData();

  return (
    <div className="min-h-screen bg-muted/10 pb-20">
      <div className="container mx-auto px-4 py-12">
        <div className="mb-16 text-center">
            <div className="inline-flex items-center justify-center p-2 px-4 bg-primary/10 rounded-full text-primary text-xs font-black uppercase tracking-widest mb-4">
              Website Index
            </div>
            <h1 className="text-4xl md:text-7xl font-black text-foreground mb-4 tracking-tight">Sitemap</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto font-medium">Explore Screenplay Pro. Every feature, category, and article in one place.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card className="border-none shadow-xl rounded-[2rem] bg-card overflow-hidden">
            <CardHeader className="bg-primary/5 pb-4">
                <CardTitle className="text-lg font-black flex items-center gap-2 uppercase tracking-tight"><FileText className="h-5 w-5 text-primary"/>Quick Links</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
                <ul className="space-y-4 text-sm">
                    {data.pages.map(page => (
                    <li key={page.url} className="flex items-center group">
                        <ChevronRight className="h-3 w-3 text-primary opacity-0 group-hover:opacity-100 transition-all -ml-4 group-hover:ml-0 mr-1" />
                        <Link href={page.url} className="text-muted-foreground hover:text-primary transition-colors font-bold uppercase tracking-tighter">{page.name}</Link>
                    </li>
                    ))}
                </ul>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl rounded-[2rem] bg-card overflow-hidden">
            <CardHeader className="bg-blue-500/5 pb-4">
                <CardTitle className="text-lg font-black flex items-center gap-2 uppercase tracking-tight"><MapPin className="h-5 w-5 text-blue-600"/>Top Cities</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
                <ul className="space-y-4 text-sm">
                    {data.cities.map(city => (
                    <li key={city.id} className="flex items-center group">
                        <ChevronRight className="h-3 w-3 text-blue-600 opacity-0 group-hover:opacity-100 transition-all -ml-4 group-hover:ml-0 mr-1" />
                        <Link href={`/${city.slug}`} className="text-muted-foreground hover:text-blue-600 transition-colors font-bold uppercase tracking-tighter">{city.name}</Link>
                    </li>
                    ))}
                </ul>
            </CardContent>
          </Card>
          
          <Card className="border-none shadow-xl rounded-[2rem] bg-card overflow-hidden">
            <CardHeader className="bg-orange-500/5 pb-4">
                <CardTitle className="text-lg font-black flex items-center gap-2 uppercase tracking-tight"><Layers className="h-5 w-5 text-orange-600"/>Categories</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
                <ul className="space-y-4 text-sm">
                    {data.categories.map(cat => (
                    <li key={cat.id} className="flex items-center group">
                        <ChevronRight className="h-3 w-3 text-orange-600 opacity-0 group-hover:opacity-100 transition-all -ml-4 group-hover:ml-0 mr-1" />
                        <Link href={`/category/${cat.slug}`} className="text-muted-foreground hover:text-orange-600 transition-colors font-bold uppercase tracking-tighter">{cat.name}</Link>
                    </li>
                    ))}
                </ul>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl rounded-[2rem] bg-card overflow-hidden">
            <CardHeader className="bg-purple-500/5 pb-4">
                <CardTitle className="text-lg font-black flex items-center gap-2 uppercase tracking-tight"><BookOpen className="h-5 w-5 text-purple-600"/>Blog Index</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
                <ul className="space-y-4 text-sm">
                    {data.blogs.slice(0, 8).map(blog => (
                    <li key={blog.id} className="flex items-start group">
                        <ChevronRight className="h-3 w-3 text-purple-600 opacity-0 group-hover:opacity-100 transition-all -ml-4 group-hover:ml-0 mr-1 mt-1" />
                        <Link href={`/blog/${blog.slug}`} className="text-muted-foreground hover:text-purple-600 transition-colors font-bold uppercase tracking-tighter leading-tight truncate">{blog.title}</Link>
                    </li>
                    ))}
                    <li>
                      <Link href="/blog" className="text-[10px] font-black uppercase text-primary hover:underline">View All Articles</Link>
                    </li>
                </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
