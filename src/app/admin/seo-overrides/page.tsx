
"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { PlusCircle, Edit, Trash2, Loader2, CheckCircle, XCircle, Zap, PackageSearch, Compass, AlertTriangle, ExternalLink, Copy } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CityCategorySeoSetting, AreaCategorySeoSetting, FirestoreCategory, FirestoreCity, FirestoreArea } from '@/types/firestore';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, query, Timestamp, where, writeBatch, limit, getCountFromServer } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Skeleton } from '@/components/ui/skeleton';
import CitySeoForm from '@/components/admin/CitySeoForm';
import AreaForm from '@/components/admin/AreaForm';
import { triggerRefresh, submitPathToGoogleIndexing } from '@/lib/revalidateUtils';
import OsmGeneratorDialog from '@/components/admin/OsmGeneratorDialog';
import OsmAreaGeneratorDialog from '@/components/admin/OsmAreaGeneratorDialog';

const generateSeoSlug = (parts: (string | undefined)[]): string => {
    return parts.filter(Boolean).map(part => part!.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')).join('/');
};

export default function SeoOverridesPage() {
  const [cityCategorySettings, setCityCategorySettings] = useState<CityCategorySeoSetting[]>([]);
  const [areaCategorySettings, setAreaCategorySettings] = useState<AreaCategorySeoSetting[]>([]);
  const [categories, setCategories] = useState<FirestoreCategory[]>([]);
  const [cities, setCities] = useState<FirestoreCity[]>([]);
  const [areas, setAreas] = useState<FirestoreArea[]>([]);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSetting, setEditingSetting] = useState<any>(null);
  const [formType, setFormType] = useState<'cityCategory' | 'areaCategory' | 'city' | 'area' | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('city-homepage');
  const [isOsmOpen, setIsOsmOpen] = useState(false);
  const [isOsmAreaOpen, setIsOsmAreaOpen] = useState(false);

  const [citiesLimit, setCitiesLimit] = useState<number | null>(100);
  const [cityCategoryLimit, setCityCategoryLimit] = useState<number | null>(100);
  const [areaCategoryLimit, setAreaCategoryLimit] = useState<number | null>(100);
  const [areasLimit, setAreasLimit] = useState<number | null>(100);

  const [totalCities, setTotalCities] = useState(0);
  const [totalCityCategories, setTotalCityCategories] = useState(0);
  const [totalAreaCategories, setTotalAreaCategories] = useState(0);
  const [totalAreas, setTotalAreas] = useState(0);

  const hasMoreCities = citiesLimit !== null && totalCities > cities.length;
  const hasMoreCityCategory = cityCategoryLimit !== null && totalCityCategories > cityCategorySettings.length;
  const hasMoreAreaCategory = areaCategoryLimit !== null && totalAreaCategories > areaCategorySettings.length;
  const hasMoreAreas = areasLimit !== null && totalAreas > areas.length;

  const handleLoadMoreCities = () => setCitiesLimit(prev => prev ? prev + 100 : 100);
  const handleLoadAllCities = () => setCitiesLimit(null);

  const handleLoadMoreCityCategory = () => setCityCategoryLimit(prev => prev ? prev + 100 : 100);
  const handleLoadAllCityCategory = () => setCityCategoryLimit(null);

  const handleLoadMoreAreaCategory = () => setAreaCategoryLimit(prev => prev ? prev + 100 : 100);
  const handleLoadAllAreaCategory = () => setAreaCategoryLimit(null);

  const handleLoadMoreAreas = () => setAreasLimit(prev => prev ? prev + 100 : 100);
  const handleLoadAllAreas = () => setAreasLimit(null);

  const cityCatSeoRef = collection(db, "cityCategorySeoSettings");
  const areaCatSeoRef = collection(db, "areaCategorySeoSettings");
  const citiesRef = collection(db, "cities");

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const citiesQuery = citiesLimit ? query(citiesRef, limit(citiesLimit)) : citiesRef;
      const areasQuery = areasLimit ? query(collection(db, "areas"), limit(areasLimit)) : collection(db, "areas");
      const cityCategoryQuery = cityCategoryLimit ? query(cityCatSeoRef, limit(cityCategoryLimit)) : cityCatSeoRef;
      const areaCategoryQuery = areaCategoryLimit ? query(areaCatSeoRef, limit(areaCategoryLimit)) : areaCatSeoRef;

      const [
        catSnap, citySnap, areaSnap, cityCatSeoSnap, areaCatSeoSnap,
        cityCountSnap, areaCountSnap, cityCatCountSnap, areaCatCountSnap
      ] = await Promise.all([
        getDocs(collection(db, "adminCategories")),
        getDocs(citiesQuery),
        getDocs(areasQuery),
        getDocs(cityCategoryQuery),
        getDocs(areaCategoryQuery),
        getCountFromServer(citiesRef),
        getCountFromServer(collection(db, "areas")),
        getCountFromServer(cityCatSeoRef),
        getCountFromServer(areaCatSeoRef),
      ]);

      setTotalCities(cityCountSnap.data().count);
      setTotalAreas(areaCountSnap.data().count);
      setTotalCityCategories(cityCatCountSnap.data().count);
      setTotalAreaCategories(areaCatCountSnap.data().count);

      const fetchedCategories = catSnap.docs.map(d => ({ ...d.data(), id: d.id } as FirestoreCategory));
      fetchedCategories.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setCategories(fetchedCategories);

      const fetchedCities = citySnap.docs.map(d => ({ ...d.data(), id: d.id } as FirestoreCity));
      fetchedCities.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setCities(fetchedCities);

      const fetchedAreas = areaSnap.docs.map(d => ({ ...d.data(), id: d.id } as FirestoreArea));
      fetchedAreas.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setAreas(fetchedAreas);

      const fetchedCityCat = cityCatSeoSnap.docs.map(d => ({ ...d.data(), id: d.id } as CityCategorySeoSetting));
      fetchedCityCat.sort((a, b) => {
        const cityComp = (a.cityName || '').localeCompare(b.cityName || '');
        if (cityComp !== 0) return cityComp;
        return (a.categoryName || '').localeCompare(b.categoryName || '');
      });
      setCityCategorySettings(fetchedCityCat);

      const fetchedAreaCat = areaCatSeoSnap.docs.map(d => ({ ...d.data(), id: d.id } as AreaCategorySeoSetting));
      fetchedAreaCat.sort((a, b) => {
        const cityComp = (a.cityName || '').localeCompare(b.cityName || '');
        if (cityComp !== 0) return cityComp;
        const areaComp = (a.areaName || '').localeCompare(b.areaName || '');
        if (areaComp !== 0) return areaComp;
        return (a.categoryName || '').localeCompare(b.categoryName || '');
      });
      setAreaCategorySettings(fetchedAreaCat);

    } catch (error) {
      console.error("Error fetching SEO override data:", error);
      toast({ title: "Error", description: "Could not load SEO override data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [citiesLimit, cityCategoryLimit, areaCategoryLimit, areasLimit]);

  const handleAddSetting = (type: 'cityCategory' | 'areaCategory' | 'city' | 'area') => {
    setEditingSetting(null);
    setFormType(type);
    setIsFormOpen(true);
  };

  const handleEditSetting = (setting: any, type: 'cityCategory' | 'areaCategory' | 'city' | 'area') => {
    setEditingSetting(setting);
    setFormType(type);
    setIsFormOpen(true);
  };

  const handleDeleteSetting = async (id: string, type: 'cityCategory' | 'areaCategory' | 'city' | 'area') => {
    setIsSubmitting(true);
    const collectionRef = 
      type === 'cityCategory' ? cityCatSeoRef : 
      type === 'areaCategory' ? areaCatSeoRef : 
      type === 'area' ? collection(db, 'areas') : 
      citiesRef;
    try {
      await deleteDoc(doc(collectionRef, id));
      
      await triggerRefresh(type === 'city' ? 'cities' : 'global-cache');
      await triggerRefresh('sitemap');

      toast({ title: "Success", description: "Deleted successfully." });
      fetchData(); 
    } catch (error) {
      toast({ title: "Error", description: "Could not delete.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAllSettings = async (type: 'cityCategory' | 'areaCategory' | 'city' | 'area') => {
    setIsSubmitting(true);
    try {
      const collectionRef = 
        type === 'cityCategory' ? cityCatSeoRef : 
        type === 'areaCategory' ? areaCatSeoRef : 
        type === 'area' ? collection(db, 'areas') : 
        citiesRef;

      // Query all documents in the collection to ensure we delete all records, not just the loaded limited page
      const snap = await getDocs(collectionRef);
      const allDocs = snap.docs;

      if (allDocs.length === 0) {
        toast({ title: "No items to delete", description: "There are no SEO settings/records to delete in this tab." });
        setIsSubmitting(false);
        return;
      }

      let batch = writeBatch(db);
      let count = 0;

      for (const d of allDocs) {
        batch.delete(d.ref);
        count++;

        if (count >= 500) {
          await batch.commit();
          await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit buffer to prevent Firestore stream exhaustion
          batch = writeBatch(db);
          count = 0;
        }
      }

      if (count > 0) {
        await batch.commit();
      }

      await triggerRefresh(type === 'city' ? 'cities' : 'global-cache');
      await triggerRefresh('sitemap');

      const typeLabel = 
        type === 'city' ? 'city homepage' : 
        type === 'area' ? 'locality' : 
        type === 'cityCategory' ? 'city-category SEO' : 'area-category SEO';

      toast({ 
        title: "Success", 
        description: `Successfully deleted all ${allDocs.length} ${typeLabel} records.` 
      });

      // Reset limits to default
      if (type === 'city') setCitiesLimit(100);
      else if (type === 'cityCategory') setCityCategoryLimit(100);
      else if (type === 'areaCategory') setAreaCategoryLimit(100);
      else if (type === 'area') setAreasLimit(100);

      fetchData();
    } catch (error) {
      console.error("Error deleting all settings:", error);
      toast({ title: "Delete All Failed", description: "Could not perform bulk deletion.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleToggleActive = async (setting: any, type: 'cityCategory' | 'areaCategory' | 'city' | 'area') => {
    setIsSubmitting(true);
    const collectionRef = 
      type === 'cityCategory' ? cityCatSeoRef : 
      type === 'areaCategory' ? areaCatSeoRef : 
      type === 'area' ? collection(db, 'areas') : 
      citiesRef;
    try {
        await updateDoc(doc(collectionRef, setting.id!), { isActive: !setting.isActive, updatedAt: Timestamp.now() });
        
        await triggerRefresh(type === 'city' ? 'cities' : 'global-cache');
        await triggerRefresh('sitemap');

        toast({ title: "Success", description: "Status updated."});
        fetchData();
    } catch (error) {
        toast({ title: "Error", description: "Could not update status.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleCityFormSubmit = async (data: any) => {
      setIsSubmitting(true);
      try {
          const payload = {
              name: data.name,
              slug: data.slug || data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
              seo_title: data.seo_title,
              seo_description: data.seo_description,
              seo_keywords: data.seo_keywords,
              h1_title: data.h1_title,
              isActive: data.isActive,
              updatedAt: Timestamp.now()
          };

          if (data.id && data.id !== 'new') {
              await updateDoc(doc(citiesRef, data.id), payload);
          } else {
              await addDoc(citiesRef, { ...payload, createdAt: Timestamp.now() });
          }
          
          await triggerRefresh('cities');
          await triggerRefresh('global-cache');
          await triggerRefresh('sitemap');

          if (payload.slug && payload.isActive) {
            submitPathToGoogleIndexing(`/${payload.slug}`, 'URL_UPDATED').catch(err => {
              console.error("Google Indexing error on city save:", err);
            });
          } else if (payload.slug && !payload.isActive) {
            submitPathToGoogleIndexing(`/${payload.slug}`, 'URL_DELETED').catch(err => {
              console.error("Google Indexing error on city save (inactive):", err);
            });
          }

          toast({ title: "Success", description: "City SEO settings saved." });
          setIsFormOpen(false); 
          fetchData();
      } catch (e) {
          toast({ title: "Error", description: (e as Error).message || "Could not save setting.", variant: "destructive" });
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleAreaFormSubmit = async (data: any) => {
      setIsSubmitting(true);
      const city = cities.find(c => c.id === data.cityId);
      if (!city) {
          toast({ title: "Error", description: "Selected parent city not found.", variant: "destructive" });
          setIsSubmitting(false);
          return;
      }
      
      try {
          const payload = {
              name: data.name,
              cityId: data.cityId,
              cityName: city.name,
              slug: data.slug || data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
              isActive: data.isActive,
              updatedAt: Timestamp.now()
          };

          const areasRef = collection(db, 'areas');
          if (data.id && data.id !== 'new') {
              await updateDoc(doc(areasRef, data.id), payload);
          } else {
              await addDoc(areasRef, { ...payload, createdAt: Timestamp.now() });
          }
          
          await triggerRefresh('global-cache');
          await triggerRefresh('sitemap');

          const citySlug = city.slug;
          const areaSlug = payload.slug;
          if (citySlug && areaSlug && payload.isActive) {
            submitPathToGoogleIndexing(`/${citySlug}/${areaSlug}`, 'URL_UPDATED').catch(err => {
              console.error("Google Indexing error on area save:", err);
            });
          } else if (citySlug && areaSlug && !payload.isActive) {
            submitPathToGoogleIndexing(`/${citySlug}/${areaSlug}`, 'URL_DELETED').catch(err => {
              console.error("Google Indexing error on area save (inactive):", err);
            });
          }

          toast({ title: "Success", description: "Locality / Area saved successfully." });
          setIsFormOpen(false); 
          fetchData();
      } catch (e) {
          toast({ title: "Error", description: (e as Error).message || "Could not save setting.", variant: "destructive" });
      } finally {
          setIsSubmitting(false);
      }
  };


  const handleCityCategoryFormSubmit = async (data: any) => {
    setIsSubmitting(true);
    const city = cities.find(c => c.id === data.cityId);
    const category = categories.find(c => c.id === data.categoryId);
    if (!city || !category) {
      toast({ title: "Error", description: "Selected city or category not found.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }
    
    // Prepare the payload for Firestore, excluding the client-side 'id' if it's a new document
    const basePayload: Omit<CityCategorySeoSetting, 'id' | 'createdAt' | 'updatedAt'> = {
        cityId: data.cityId,
        cityName: city.name,
        categoryId: data.categoryId,
        categoryName: category.name,
        slug: data.slug || generateSeoSlug([city.slug, category.slug]), 
        h1_title: data.h1_title,
        meta_title: data.meta_title,
        meta_description: data.meta_description,
        meta_keywords: data.meta_keywords,
        imageHint: data.imageHint,
        isActive: data.isActive,
    };

    try {
      if (data.id) { // Editing existing
        await updateDoc(doc(cityCatSeoRef, data.id), { ...basePayload, updatedAt: Timestamp.now() });
      } else { // Adding new
        // Check for duplicates before adding
        const q = query(cityCatSeoRef, where("cityId", "==", data.cityId), where("categoryId", "==", data.categoryId));
        const snap = await getDocs(q);
        if (!snap.empty) {
           toast({ title: "Duplicate Entry", description: "An SEO override for this city and category already exists.", variant: "destructive"});
           setIsSubmitting(false); return;
        }
        await addDoc(cityCatSeoRef, { ...basePayload, createdAt: Timestamp.now() });
      }

      await triggerRefresh('global-cache');
      await triggerRefresh('sitemap');

      const citySlug = city.slug;
      const categorySlug = category.slug;
      if (citySlug && categorySlug && basePayload.isActive) {
        submitPathToGoogleIndexing(`/${citySlug}/category/${categorySlug}`, 'URL_UPDATED').catch(err => {
          console.error("Google Indexing error on city-category save:", err);
        });
      } else if (citySlug && categorySlug && !basePayload.isActive) {
        submitPathToGoogleIndexing(`/${citySlug}/category/${categorySlug}`, 'URL_DELETED').catch(err => {
          console.error("Google Indexing error on city-category save (inactive):", err);
        });
      }

      toast({ title: "Success", description: "City-Category SEO setting saved." });
      setIsFormOpen(false); fetchData();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message || "Could not save setting.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleAreaCategoryFormSubmit = async (data: any) => {
    setIsSubmitting(true);
    const city = cities.find(c => c.id === data.cityId);
    const area = areas.find(a => a.id === data.areaId);
    const category = categories.find(c => c.id === data.categoryId);
    if (!city || !area || !category) {
      toast({ title: "Error", description: "Selected city, area, or category not found.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }
    
    const basePayload: Omit<AreaCategorySeoSetting, 'id' | 'createdAt' | 'updatedAt'> = {
      cityId: data.cityId, cityName: city.name, areaId: data.areaId, areaName: area.name,
      categoryId: data.categoryId, categoryName: category.name, 
      slug: data.slug || generateSeoSlug([city.slug, area.slug, category.slug]),
      h1_title: data.h1_title, meta_title: data.meta_title, meta_description: data.meta_description,
      meta_keywords: data.meta_keywords, imageHint: data.imageHint, isActive: data.isActive,
    };

    try {
      if (data.id) { // Editing existing
        await updateDoc(doc(areaCatSeoRef, data.id), { ...basePayload, updatedAt: Timestamp.now() });
      } else { // Adding new
        const q = query(areaCatSeoRef, where("areaId", "==", data.areaId), where("categoryId", "==", data.categoryId));
        const snap = await getDocs(q);
        if (!snap.empty) {
           toast({ title: "Duplicate Entry", description: "An SEO override for this area and category already exists.", variant: "destructive"});
           setIsSubmitting(false); return;
        }
        await addDoc(areaCatSeoRef, { ...basePayload, createdAt: Timestamp.now() });
      }

      await triggerRefresh('global-cache');
      await triggerRefresh('sitemap');

      const citySlug = city.slug;
      const areaSlug = area.slug;
      const categorySlug = category.slug;
      if (citySlug && areaSlug && categorySlug && basePayload.isActive) {
        submitPathToGoogleIndexing(`/${citySlug}/${areaSlug}/category/${categorySlug}`, 'URL_UPDATED').catch(err => {
          console.error("Google Indexing error on area-category save:", err);
        });
      } else if (citySlug && areaSlug && categorySlug && !basePayload.isActive) {
        submitPathToGoogleIndexing(`/${citySlug}/${areaSlug}/category/${categorySlug}`, 'URL_DELETED').catch(err => {
          console.error("Google Indexing error on area-category save (inactive):", err);
        });
      }

      toast({ title: "Success", description: "Area-Category SEO setting saved." });
      setIsFormOpen(false); fetchData();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message || "Could not save setting.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };


  const citiesExist = cities.length > 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card><CardHeader><Skeleton className="h-8 w-1/2" /><Skeleton className="h-4 w-3/4 mt-2" /></CardHeader>
          <CardContent><Skeleton className="h-64 w-full" /></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isSubmitting && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
          <p className="text-sm font-bold text-muted-foreground animate-pulse">Processing request, please wait...</p>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center"><Zap className="mr-2 h-6 w-6 text-primary" />Advanced SEO Overrides</CardTitle>
          <CardDescription>Manage specific SEO settings for City-Category and Area-Category combinations.</CardDescription>
        </CardHeader>
      </Card>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex w-full overflow-x-auto justify-start gap-2 bg-transparent p-1 h-auto scrollbar-none md:grid md:grid-cols-4 md:bg-muted md:h-10 md:gap-0">
          <TabsTrigger value="city-homepage" className="flex-shrink-0 whitespace-nowrap">City Homepages</TabsTrigger>
          <TabsTrigger value="city-category" className="flex-shrink-0 whitespace-nowrap">City-Category SEO</TabsTrigger>
          <TabsTrigger value="area-category" className="flex-shrink-0 whitespace-nowrap">Area-Category SEO</TabsTrigger>
          <TabsTrigger value="manage-areas" className="flex-shrink-0 whitespace-nowrap">Localities / Areas</TabsTrigger>
        </TabsList>
        <TabsContent value="city-homepage">
          <Card>
            <CardHeader className="flex flex-col gap-4 items-stretch justify-start md:flex-row md:items-center md:justify-between">
              <div><CardTitle>City-Specific Homepages</CardTitle><CardDescription>Custom SEO and H1 for /[citySlug] pages.</CardDescription></div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button variant="outline" onClick={() => setIsOsmOpen(true)} disabled={isSubmitting}>
                  <Compass className="mr-2 h-4 w-4 text-primary" /> OSM Generator
                </Button>
                <Button onClick={() => handleAddSetting('city')} disabled={isSubmitting}><PlusCircle className="mr-2 h-4 w-4"/>Add New City</Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isSubmitting || !citiesExist}>
                      <Trash2 className="mr-2 h-4 w-4" /> Delete All Cities
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-5 w-5 animate-bounce" /> Confirm Delete All
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete ALL registered cities from the database? This will permanently remove them and all their pages.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteAllSettings('city')} className="bg-destructive hover:bg-destructive/90">
                        Delete All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>City Name</TableHead><TableHead>Slug</TableHead><TableHead>H1 Title</TableHead><TableHead className="text-center">Active</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {cities.map(city => (
                    <TableRow key={city.id}>
                      <TableCell className="font-bold">{city.name}</TableCell>
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1.5 font-mono">
                          <a 
                            href={`/${city.slug}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="hover:underline text-primary flex items-center gap-1 font-semibold"
                            title="Open page in new tab"
                          >
                            /{city.slug}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/${city.slug}`);
                              toast({ title: "Copied", description: "URL copied to clipboard." });
                            }}
                            title="Copy full URL"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs max-w-xs truncate" title={city.h1_title}>{city.h1_title || "Using global pattern"}</TableCell>
                      <TableCell className="text-center"><Switch checked={city.isActive} onCheckedChange={() => handleToggleActive(city, 'city')} disabled={isSubmitting}/></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEditSetting(city, 'city')} disabled={isSubmitting}>
                            <Edit className="h-4 w-4 mr-2"/>SEO
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="icon" disabled={isSubmitting}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Confirmation</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete the city "{city.name}"? This will permanently remove the city from the database.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteSetting(city.id!, 'city')} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalCities > 0 && (
                <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-2 p-3 bg-muted/20 border rounded-2xl">
                  {hasMoreCities ? (
                    <Button variant="outline" size="sm" onClick={handleLoadMoreCities} className="font-semibold rounded-xl">
                      Load More (+100 Cities)
                    </Button>
                  ) : (
                    <div className="w-[120px] hidden sm:block" />
                  )}
                  <span className="text-xs text-muted-foreground font-medium">Currently showing {cities.length} of {totalCities} cities</span>
                  {hasMoreCities ? (
                    <Button variant="ghost" size="sm" onClick={handleLoadAllCities} className="text-primary hover:text-primary/95 hover:bg-primary/5 font-bold rounded-xl">
                      Load All Cities
                    </Button>
                  ) : (
                    <div className="w-[120px] hidden sm:block" />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="city-category">
          <Card>
            <CardHeader className="flex flex-col gap-4 items-stretch justify-start md:flex-row md:items-center md:justify-between">
              <div><CardTitle>City-Category Specific Settings</CardTitle><CardDescription>Overrides for /[city]/category/[categorySlug] pages.</CardDescription></div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button variant="outline" onClick={() => setIsOsmOpen(true)} disabled={isSubmitting || categories.length === 0}>
                  <Compass className="mr-2 h-4 w-4 text-primary" /> OSM Generator
                </Button>
                <Button onClick={() => handleAddSetting('cityCategory')} disabled={isSubmitting || cities.length === 0 || categories.length === 0}><PlusCircle className="mr-2 h-4 w-4"/>Add New</Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isSubmitting || cityCategorySettings.length === 0}>
                      <Trash2 className="mr-2 h-4 w-4" /> Delete All
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-5 w-5 animate-bounce" /> Confirm Delete All
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete ALL City-Category SEO Override configurations? This will permanently remove all entries.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteAllSettings('cityCategory')} className="bg-destructive hover:bg-destructive/90">
                        Delete All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardHeader>
            <CardContent>
              {cityCategorySettings.length === 0 ? (
                 <div className="text-center py-10"><PackageSearch className="mx-auto h-12 w-12 text-muted-foreground mb-3" /><p className="text-muted-foreground">No City-Category SEO overrides found.</p></div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>City</TableHead><TableHead>Category</TableHead><TableHead>Slug Segment</TableHead><TableHead>H1 Title</TableHead><TableHead className="text-center">Active</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {cityCategorySettings.map(setting => (
                      <TableRow key={setting.id}>
                        <TableCell>{setting.cityName}</TableCell><TableCell>{setting.categoryName}</TableCell>
                        <TableCell className="text-xs">
                        <div className="flex items-center gap-1.5 font-mono">
                          <a 
                            href={setting.slug.startsWith('/') ? setting.slug : `/${setting.slug}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="hover:underline text-primary flex items-center gap-1 font-semibold"
                            title="Open page in new tab"
                          >
                            /{setting.slug.startsWith('/') ? setting.slug.slice(1) : setting.slug}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
                            onClick={() => {
                              const path = setting.slug.startsWith('/') ? setting.slug : `/${setting.slug}`;
                              navigator.clipboard.writeText(`${window.location.origin}${path}`);
                              toast({ title: "Copied", description: "URL copied to clipboard." });
                            }}
                            title="Copy full URL"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                        <TableCell className="text-xs max-w-xs truncate" title={setting.h1_title}>{setting.h1_title || "Not set"}</TableCell>
                        <TableCell className="text-center"><Switch checked={setting.isActive} onCheckedChange={() => handleToggleActive(setting, 'cityCategory')} disabled={isSubmitting}/></TableCell>
                        <TableCell className="text-right"><div className="flex justify-end gap-2"><Button variant="outline" size="icon" onClick={() => handleEditSetting(setting, 'cityCategory')} disabled={isSubmitting}><Edit className="h-4 w-4"/></Button> <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="icon" disabled={isSubmitting}><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Confirmation</AlertDialogTitle><AlertDialogDescription>Delete SEO override for {setting.cityName} - {setting.categoryName}?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteSetting(setting.id!, 'cityCategory')} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {totalCityCategories > 0 && (
                <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-2 p-3 bg-muted/20 border rounded-2xl">
                  {hasMoreCityCategory ? (
                    <Button variant="outline" size="sm" onClick={handleLoadMoreCityCategory} className="font-semibold rounded-xl">
                      Load More (+100 Settings)
                    </Button>
                  ) : (
                    <div className="w-[120px] hidden sm:block" />
                  )}
                  <span className="text-xs text-muted-foreground font-medium">Currently showing {cityCategorySettings.length} of {totalCityCategories} overrides</span>
                  {hasMoreCityCategory ? (
                    <Button variant="ghost" size="sm" onClick={handleLoadAllCityCategory} className="text-primary hover:text-primary/95 hover:bg-primary/5 font-bold rounded-xl">
                      Load All Settings
                    </Button>
                  ) : (
                    <div className="w-[120px] hidden sm:block" />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="area-category">
          <Card>
            <CardHeader className="flex flex-col gap-4 items-stretch justify-start md:flex-row md:items-center md:justify-between">
              <div><CardTitle>Area-Category Specific Settings</CardTitle><CardDescription>Overrides for /[city]/[area]/[categorySlug] pages.</CardDescription></div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button variant="outline" onClick={() => setIsOsmAreaOpen(true)} disabled={isSubmitting || cities.length === 0 || categories.length === 0}>
                  <Compass className="mr-2 h-4 w-4 text-primary" /> OSM Generator
                </Button>
                <Button onClick={() => handleAddSetting('areaCategory')} disabled={isSubmitting || cities.length === 0 || categories.length === 0}><PlusCircle className="mr-2 h-4 w-4"/>Add New</Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isSubmitting || areaCategorySettings.length === 0}>
                      <Trash2 className="mr-2 h-4 w-4" /> Delete All
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-5 w-5 animate-bounce" /> Confirm Delete All
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete ALL Area-Category SEO Override configurations? This will permanently remove all entries.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteAllSettings('areaCategory')} className="bg-destructive hover:bg-destructive/90">
                        Delete All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardHeader>
            <CardContent>
            {areaCategorySettings.length === 0 ? (
                <div className="text-center py-10"><PackageSearch className="mx-auto h-12 w-12 text-muted-foreground mb-3" /><p className="text-muted-foreground">No Area-Category SEO overrides found.</p></div>
            ) : (
                <Table>
                    <TableHeader><TableRow><TableHead>City</TableHead><TableHead>Area</TableHead><TableHead>Category</TableHead><TableHead>Slug Segment</TableHead><TableHead>H1 Title</TableHead><TableHead className="text-center">Active</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                    {areaCategorySettings.map(setting => (
                        <TableRow key={setting.id}>
                        <TableCell>{setting.cityName}</TableCell><TableCell>{setting.areaName}</TableCell><TableCell>{setting.categoryName}</TableCell>
                        <TableCell className="text-xs">
                        <div className="flex items-center gap-1.5 font-mono">
                          <a 
                            href={setting.slug.startsWith('/') ? setting.slug : `/${setting.slug}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="hover:underline text-primary flex items-center gap-1 font-semibold"
                            title="Open page in new tab"
                          >
                            /{setting.slug.startsWith('/') ? setting.slug.slice(1) : setting.slug}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
                            onClick={() => {
                              const path = setting.slug.startsWith('/') ? setting.slug : `/${setting.slug}`;
                              navigator.clipboard.writeText(`${window.location.origin}${path}`);
                              toast({ title: "Copied", description: "URL copied to clipboard." });
                            }}
                            title="Copy full URL"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                        <TableCell className="text-xs max-w-xs truncate" title={setting.h1_title}>{setting.h1_title || "Not set"}</TableCell>
                        <TableCell className="text-center"><Switch checked={setting.isActive} onCheckedChange={() => handleToggleActive(setting, 'areaCategory')} disabled={isSubmitting}/></TableCell>
                        <TableCell className="text-right"><div className="flex justify-end gap-2"><Button variant="outline" size="icon" onClick={() => handleEditSetting(setting, 'areaCategory')} disabled={isSubmitting}><Edit className="h-4 w-4"/></Button> <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="icon" disabled={isSubmitting}><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Confirmation</AlertDialogTitle><AlertDialogDescription>Delete SEO override for {setting.areaName} - {setting.categoryName}?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteSetting(setting.id!, 'areaCategory')} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div></TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
             )}
             {totalAreaCategories > 0 && (
               <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-2 p-3 bg-muted/20 border rounded-2xl">
                 {hasMoreAreaCategory ? (
                   <Button variant="outline" size="sm" onClick={handleLoadMoreAreaCategory} className="font-semibold rounded-xl">
                     Load More (+100 Settings)
                   </Button>
                 ) : (
                   <div className="w-[120px] hidden sm:block" />
                 )}
                 <span className="text-xs text-muted-foreground font-medium">Currently showing {areaCategorySettings.length} of {totalAreaCategories} overrides</span>
                 {hasMoreAreaCategory ? (
                   <Button variant="ghost" size="sm" onClick={handleLoadAllAreaCategory} className="text-primary hover:text-primary/95 hover:bg-primary/5 font-bold rounded-xl">
                     Load All Settings
                   </Button>
                 ) : (
                   <div className="w-[120px] hidden sm:block" />
                 )}
               </div>
             )}
             </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage-areas">
          <Card>
            <CardHeader className="flex flex-col gap-4 items-stretch justify-start md:flex-row md:items-center md:justify-between">
              <div><CardTitle>Localities / Areas Management</CardTitle><CardDescription>Create and manage areas/localities within cities.</CardDescription></div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button variant="outline" onClick={() => setIsOsmAreaOpen(true)} disabled={isSubmitting || cities.length === 0}>
                  <Compass className="mr-2 h-4 w-4 text-primary" /> OSM Generator
                </Button>
                <Button onClick={() => handleAddSetting('area')} disabled={isSubmitting || cities.length === 0}><PlusCircle className="mr-2 h-4 w-4"/>Add New Area</Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isSubmitting || areas.length === 0}>
                      <Trash2 className="mr-2 h-4 w-4" /> Delete All Localities
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-5 w-5 animate-bounce" /> Confirm Delete All
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete ALL registered Localities / Areas from the database? This will permanently delete all neighborhoods.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteAllSettings('area')} className="bg-destructive hover:bg-destructive/90">
                        Delete All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardHeader>
            <CardContent>
              {areas.length === 0 ? (
                 <div className="text-center py-10"><PackageSearch className="mx-auto h-12 w-12 text-muted-foreground mb-3" /><p className="text-muted-foreground">No Areas/Localities found.</p></div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Area Name</TableHead><TableHead>Parent City</TableHead><TableHead>Slug</TableHead><TableHead className="text-center">Active</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {areas.map(area => (
                      <TableRow key={area.id}>
                        <TableCell className="font-bold">{area.name}</TableCell>
                        <TableCell>{area.cityName || cities.find(c => c.id === area.cityId)?.name || 'Unknown'}</TableCell>
                        <TableCell className="text-xs">
                          {(() => {
                            const parentCitySlug = cities.find(c => c.id === area.cityId)?.slug || '';
                            const finalPath = parentCitySlug ? `/${parentCitySlug}/${area.slug}` : `/${area.slug}`;
                            return (
                              <div className="flex items-center gap-1.5 font-mono">
                                <a 
                                  href={finalPath} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="hover:underline text-primary flex items-center gap-1 font-semibold"
                                  title="Open page in new tab"
                                >
                                  {finalPath}
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
                                  onClick={() => {
                                    navigator.clipboard.writeText(`${window.location.origin}${finalPath}`);
                                    toast({ title: "Copied", description: "URL copied to clipboard." });
                                  }}
                                  title="Copy full URL"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-center"><Switch checked={area.isActive} onCheckedChange={() => handleToggleActive(area, 'area')} disabled={isSubmitting}/></TableCell>
                        <TableCell className="text-right"><div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => handleEditSetting(area, 'area')} disabled={isSubmitting}><Edit className="h-4 w-4 mr-2"/>Edit</Button><AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="icon" disabled={isSubmitting}><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Confirmation</AlertDialogTitle><AlertDialogDescription>Delete locality {area.name}?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteSetting(area.id!, 'area')} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {totalAreas > 0 && (
                <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-2 p-3 bg-muted/20 border rounded-2xl">
                  {hasMoreAreas ? (
                    <Button variant="outline" size="sm" onClick={handleLoadMoreAreas} className="font-semibold rounded-xl">
                      Load More (+100 Areas)
                    </Button>
                  ) : (
                    <div className="w-[120px] hidden sm:block" />
                  )}
                  <span className="text-xs text-muted-foreground font-medium">Currently showing {areas.length} of {totalAreas} areas</span>
                  {hasMoreAreas ? (
                    <Button variant="ghost" size="sm" onClick={handleLoadAllAreas} className="text-primary hover:text-primary/95 hover:bg-primary/5 font-bold rounded-xl">
                      Load All Areas
                    </Button>
                  ) : (
                    <div className="w-[120px] hidden sm:block" />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isFormOpen} onOpenChange={(open) => { if (!isSubmitting) { setIsFormOpen(open); if (!open) { setEditingSetting(null); setFormType(null); } }}}>
        <DialogContent className="w-full max-w-xs sm:max-w-md md:max-w-lg lg:max-w-xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="p-2 pb-4 border-b">
            <DialogTitle>{editingSetting ? 'Edit' : 'Add New'} {formType === 'city' ? 'City Homepage' : formType === 'area' ? 'Locality / Area' : formType === 'cityCategory' ? 'City-Category' : 'Area-Category'} Setting</DialogTitle>
            <DialogDescription>Fill in the details below.</DialogDescription>
          </DialogHeader>
          <div className="p-2">
            {(formType !== 'city' && formType !== 'area' && (cities.length === 0 || categories.length === 0)) || (formType === 'area' && cities.length === 0) ? (
                 <div className="py-8 text-center"><PackageSearch className="mx-auto h-10 w-10 text-muted-foreground mb-3" /><p className="text-destructive">Cannot add settings: Cities, Categories (and Areas for area-specific) must exist first.</p></div>
            ) : formType === 'city' ? (
              <CitySeoForm 
                initialData={editingSetting} 
                onSubmit={handleCityFormSubmit} 
                onCancel={() => setIsFormOpen(false)} 
                isSubmitting={isSubmitting} 
              />
            ) : formType === 'area' ? (
              <AreaForm
                initialData={editingSetting}
                cities={cities}
                onSubmit={handleAreaFormSubmit}
                onCancel={() => setIsFormOpen(false)}
                isSubmitting={isSubmitting}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
      <OsmGeneratorDialog 
        isOpen={isOsmOpen}
        onClose={() => setIsOsmOpen(false)}
        activeTab={activeTab}
        categories={categories}
        existingCities={cities}
        existingAreas={areas}
        existingCityCategorySettings={cityCategorySettings}
        existingAreaCategorySettings={areaCategorySettings}
        onSuccess={fetchData}
      />
      <OsmAreaGeneratorDialog 
        isOpen={isOsmAreaOpen}
        onClose={() => setIsOsmAreaOpen(false)}
        activeTab={activeTab}
        categories={categories}
        existingCities={cities}
        existingAreas={areas}
        existingAreaCategorySettings={areaCategorySettings}
        onSuccess={fetchData}
      />
    </div>
  );
}

    