"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { 
  Globe, Search, Check, Loader2, Sparkles, MapPin, 
  Compass, HelpCircle, Layers, CheckSquare, Square, RefreshCw, Database
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { triggerRefresh } from '@/lib/revalidateUtils';
import { Progress } from "@/components/ui/progress";
import type { FirestoreCategory, FirestoreCity, FirestoreArea, AreaCategorySeoSetting } from '@/types/firestore';

interface OsmAreaGeneratorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string; // 'manage-areas' | 'area-category'
  categories: FirestoreCategory[];
  existingCities: FirestoreCity[];
  existingAreas: FirestoreArea[];
  existingAreaCategorySettings?: AreaCategorySeoSetting[];
  onSuccess: () => void;
}

// 4 Distinct SEO templates for Area-Category combinations
const AREA_CATEGORY_TEMPLATES = [
  {
    h1: "Hire Verified {categoryName}s in {areaName}, {cityName} - screenplaypro.in",
    title: "Best {categoryName}s in {areaName}, {cityName} | Vetted Talent | screenplaypro.in",
    description: "Find verified local {categoryName}s in {areaName}, {cityName} on screenplaypro.in. Connect with casting-ready talents for local projects, commercial shoots, and events near {areaName} and adjacent regions like {nearbyCities}.",
  },
  {
    h1: "Top Vetted {categoryName}s in {areaName}, {cityName} | screenplaypro.in",
    title: "Verified {categoryName}s in {areaName}, {cityName} | screenplaypro.in Casting",
    description: "Discover professional local {categoryName}s in {areaName}, {cityName} on screenplaypro.in. Vetted creative talents are available for media productions, events, and bookings in neighbouring areas like {nearbyCities}.",
  },
  {
    h1: "Connect with {categoryName}s in {areaName}, {cityName} on screenplaypro.in",
    title: "{categoryName} Casting Directory in {areaName}, {cityName} | screenplaypro.in",
    description: "Ultimate platform for hiring verified local {categoryName}s in {areaName}, {cityName} on screenplaypro.in. Explore booking portfolios and connect with production-ready artists near {areaName} and adjacent {nearbyCities}.",
  },
  {
    h1: "Book Local {categoryName}s in {areaName}, {cityName} - screenplaypro.in",
    title: "Book {categoryName}s in {areaName}, {cityName} | Vetted Portfolios | screenplaypro.in",
    description: "Browse verified profiles of local {categoryName}s in {areaName}, {cityName} on screenplaypro.in. Direct messaging and casting invites for events, film, and media shoots near {areaName} and surrounding {nearbyCities}.",
  }
];

// Helper to generate at least 20 rich keywords for area category page
const generateAreaKeywordsList = (cityName: string, areaName: string, categoryName: string, nearbyAreas: string): string => {
  return [
    `${areaName} ${categoryName}s`,
    `hire ${categoryName}s in ${areaName}`,
    `verified ${categoryName}s in ${areaName}`,
    `book ${categoryName}s in ${areaName}`,
    `best ${categoryName}s in ${areaName}`,
    `casting calls for ${categoryName}s in ${areaName}`,
    `${categoryName} auditions ${areaName}`,
    `${areaName} creative talents`,
    `hire local ${categoryName}s in ${areaName}`,
    `screenplaypro ${areaName}`,
    `casting directors looking for ${categoryName}s in ${areaName}`,
    `professional ${categoryName} bookings in ${areaName}`,
    `entertainment jobs in ${areaName} ${cityName}`,
    `${areaName} talent directory`,
    `portfolio booking for ${categoryName}s in ${areaName}`,
    `production crew in ${areaName}`,
    `acting and modeling in ${areaName}`,
    `hire artists in ${areaName} ${cityName}`,
    `${categoryName}s near ${nearbyAreas}`,
    `book local talents in ${nearbyAreas}`,
    `casting options in ${nearbyAreas}`,
    `creative professionals near ${nearbyAreas}`,
    `screenplaypro.in casting call ${areaName}`,
    `verified models and actors in ${areaName}`
  ].join(", ");
};

export default function OsmAreaGeneratorDialog({
  isOpen,
  onClose,
  activeTab,
  categories,
  existingCities: propsExistingCities,
  existingAreas: propsExistingAreas,
  existingAreaCategorySettings = [],
  onSuccess,
}: OsmAreaGeneratorDialogProps) {
  const [fullCities, setFullCities] = useState<FirestoreCity[]>([]);
  const [fullAreas, setFullAreas] = useState<FirestoreArea[]>([]);

  useEffect(() => {
    if (isOpen) {
      const fetchFullDbData = async () => {
        try {
          const [citiesRes, areasRes] = await Promise.all([
            fetch('/api/db/collections?name=cities'),
            fetch('/api/db/collections?name=areas')
          ]);
          const [citiesJson, areasJson] = await Promise.all([
            citiesRes.json(), areasRes.json()
          ]);

          const loadedCities = (citiesJson.success && Array.isArray(citiesJson.data)) ? citiesJson.data : [];
          loadedCities.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
          setFullCities(loadedCities);

          const loadedAreas = (areasJson.success && Array.isArray(areasJson.data)) ? areasJson.data : [];
          loadedAreas.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
          setFullAreas(loadedAreas);
        } catch (err) {
          console.error("Error fetching full cities/areas for checklist generator:", err);
        }
      };
      fetchFullDbData();
    }
  }, [isOpen]);

  const existingCities = fullCities.length > 0 ? fullCities : propsExistingCities;
  const existingAreas = fullAreas.length > 0 ? fullAreas : propsExistingAreas;

  const { toast } = useToast();
  const [selectedCityId, setSelectedCityId] = useState('');
  
  const [overwriteExisting, setOverwriteExisting] = useState(true);
  const [areaScope, setAreaScope] = useState<'major' | 'all'>('all');
  const [areasSource, setAreasSource] = useState<'osm' | 'db'>('db');

  const [isLoadingOsm, setIsLoadingOsm] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [osmItems, setOsmItems] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItemNames, setSelectedItemNames] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [totalProgress, setTotalProgress] = useState(0);

  // Reset dialog state
  useEffect(() => {
    if (isOpen) {
      setOsmItems([]);
      setSearchTerm('');
      setSelectedItemNames([]);
      setOverwriteExisting(true);
      setSelectedCategoryIds(categories.map(c => c.id));
      setAreasSource('db');

      if (existingCities.length > 0) {
        setSelectedCityId(existingCities[0].id);
      }
    }
  }, [isOpen, categories, existingCities]);

  const selectedParentCity = useMemo(() => {
    return existingCities.find(c => c.id === selectedCityId) || null;
  }, [existingCities, selectedCityId]);

  // Sync checklist when parent city or areasSource changes
  useEffect(() => {
    if (isOpen && areasSource === 'db' && selectedCityId) {
      const filteredAreas = existingAreas
        .filter(a => a.cityId === selectedCityId)
        .map(a => ({
          name: a.name,
          lat: (a as any).lat || 20,
          lon: (a as any).lon || 78,
          population: 0,
          state: '',
          isDbSource: true,
          id: a.id
        }));
      setOsmItems(filteredAreas);
      setSelectedItemNames(filteredAreas.filter(a => !isItemDisabled(a.name)).map(a => a.name));
    } else if (isOpen && areasSource === 'osm') {
      setOsmItems([]);
      setSelectedItemNames([]);
    }
  }, [areasSource, selectedCityId, existingAreas, isOpen]);

  // Deselect disabled items dynamically if overwriteExisting toggle is turned off
  useEffect(() => {
    if (!overwriteExisting && isOpen) {
      setSelectedItemNames(prev => prev.filter(name => !isItemDisabled(name)));
    }
  }, [overwriteExisting, isOpen]);

  // Fetch suburbs/neighborhoods using coordinate-based radius fallback
  const handleFetchOsm = async () => {
    if (!selectedParentCity) {
      toast({ title: "Error", description: "Please select a parent city first.", variant: "destructive" });
      return;
    }

    setIsLoadingOsm(true);
    setOsmItems([]);
    setSelectedItemNames([]);

    const OVERPASS_SERVERS = [
      'https://overpass-api.de/api/interpreter',
      'https://lz4.overpass-api.de/api/interpreter',
      'https://z.overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass.openstreetmap.ru/api/interpreter',
      'https://overpass.osm.ch/api/interpreter'
    ];

    try {
      const cityNameClean = selectedParentCity.name.trim();
      let elements: any[] = [];
      let lastError: any = null;

      // STEP 1: Find the city's coordinates (handles alt_name / old_name like Bangalore vs Bengaluru)
      const coordQuery = `[out:json][timeout:15];(node["place"~"city|town"]["name"~"${cityNameClean}",i];node["place"~"city|town"]["alt_name"~"${cityNameClean}",i];node["place"~"city|town"]["old_name"~"${cityNameClean}",i];);out body;`;
      
      let coordRes: any = null;
      for (const server of OVERPASS_SERVERS) {
        try {
          const url = `${server}?data=${encodeURIComponent(coordQuery)}`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000);
          coordRes = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (coordRes.ok) break;
        } catch (e) {
          console.warn(`City coordinates fetch failed from ${server}:`, e);
          lastError = e;
        }
      }

      let lat = 12.9716; // default Bangalore lat
      let lon = 77.5946; // default Bangalore lon
      let foundCoords = false;

      if (coordRes && coordRes.ok) {
        const coordData = await coordRes.json();
        const nodes = coordData.elements || [];
        if (nodes.length > 0) {
          // Sort by population to find the most accurate city node
          nodes.sort((a: any, b: any) => {
            const popA = a.tags?.population ? parseInt(a.tags.population, 10) : 0;
            const popB = b.tags?.population ? parseInt(b.tags.population, 10) : 0;
            return popB - popA;
          });
          lat = nodes[0].lat;
          lon = nodes[0].lon;
          foundCoords = true;
          console.log(`Found OSM coordinates for ${cityNameClean}: ${lat}, ${lon}`);
        }
      }

      // STEP 2: Query suburbs and neighborhoods within a 20km radius around these coordinates
      const selector = areaScope === 'major' ? 'node["place"="suburb"]' : 'node["place"~"suburb|neighbourhood|quarter"]';
      const radiusQuery = `[out:json][timeout:30];(${selector}(around:20000,${lat},${lon}););out body;`;
      
      let suburbsRes: any = null;
      for (const server of OVERPASS_SERVERS) {
        try {
          const url = `${server}?data=${encodeURIComponent(radiusQuery)}`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout per mirror
          suburbsRes = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (suburbsRes.ok) break;
        } catch (e) {
          console.warn(`Suburbs fetch failed from ${server}:`, e);
          lastError = e;
        }
      }

      if (!suburbsRes || !suburbsRes.ok) {
        // Fallback: Try boundary area query directly if radius search failed
        const boundaryQuery = `[out:json][timeout:25];area[name="${cityNameClean}"]->.a;(${selector}(area.a););out body;`;
        for (const server of OVERPASS_SERVERS) {
          try {
            const url = `${server}?data=${encodeURIComponent(boundaryQuery)}`;
            suburbsRes = await fetch(url);
            if (suburbsRes.ok) break;
          } catch (e) {
            lastError = e;
          }
        }
      }

      if (suburbsRes && suburbsRes.ok) {
        const data = await suburbsRes.json();
        elements = data.elements || [];
      } else {
        throw new Error(lastError?.message || "Failed to fetch areas from all mirrors.");
      }

      if (elements.length === 0) {
        toast({ 
          title: "No Results", 
          description: `No suburbs found for ${cityNameClean}. Try switching Area Filter Scope to "All Suburbs".`,
          variant: "destructive" 
        });
        setIsLoadingOsm(false);
        return;
      }

      // Parse and clean suburbs
      const parsed = elements
        .map((el: any) => {
          const name = el.tags["name:en"] || el.tags.name;
          return {
            name,
            lat: el.lat,
            lon: el.lon,
            population: 0,
            state: el.tags.state || ""
          };
        })
        .filter((item: any) => item.name && item.lat && item.lon);

      // Remove duplicates
      const uniqueMap = new Map<string, any>();
      parsed.forEach((item: any) => {
        if (!uniqueMap.has(item.name.toLowerCase())) {
          uniqueMap.set(item.name.toLowerCase(), item);
        }
      });
      const uniqueList = Array.from(uniqueMap.values());
      uniqueList.sort((a, b) => a.name.localeCompare(b.name));

      setOsmItems(uniqueList);
      
      // Auto-select top 30 active items by default (excluding already existing items)
      const defaultSelected = uniqueList
        .filter(item => {
          const isDisabled = 
            (activeTab === 'manage-areas' && existingAreas.some(a => a.cityId === selectedCityId && a.name.toLowerCase() === item.name.toLowerCase())) ||
            ((activeTab === 'area-category' && areasSource === 'osm') && existingAreas.some(a => a.cityId === selectedCityId && a.name.toLowerCase() === item.name.toLowerCase()));
          return !isDisabled;
        })
        .slice(0, 30)
        .map(item => item.name);
      setSelectedItemNames(defaultSelected);

      toast({ 
        title: "Areas Loaded", 
        description: `Successfully loaded ${uniqueList.length} suburbs from OpenStreetMap. Auto-selected top 30.` 
      });

    } catch (error: any) {
      console.error("OSM Area Fetch Error:", error);
      toast({ 
        title: "Fetch Failed", 
        description: error.message || "Failed to fetch localities. Check internet connection and try again.", 
        variant: "destructive" 
      });
    } finally {
      setIsLoadingOsm(false);
    }
  };

  // Helper: Find nearby suburbs using distance calculation
  const getNearbyLocationNames = (target: any, all: any[], count = 3): string => {
    const nearby = all
      .filter(item => item.name.toLowerCase() !== target.name.toLowerCase())
      .map(item => {
        const dist = Math.pow(item.lat - target.lat, 2) + Math.pow(item.lon - target.lon, 2);
        return { name: item.name, dist };
      })
      .sort((a, b) => a.dist - b.dist)
      .slice(0, count)
      .map(item => item.name);

    if (nearby.length === 0) {
      return "adjacent sectors";
    }
    return nearby.join(", ");
  };

  const isItemDisabled = (itemName: string) => {
    if (overwriteExisting) {
      return false;
    }
    if (activeTab === 'manage-areas') {
      return existingAreas.some(
        a => a.cityId === selectedCityId && a.name.toLowerCase() === itemName.toLowerCase()
      );
    }
    if (activeTab === 'area-category') {
      if (areasSource === 'osm') {
        const areaExists = existingAreas.some(
          a => a.cityId === selectedCityId && a.name.toLowerCase() === itemName.toLowerCase()
        );
        if (areaExists) return true;
      }
      const parentCity = existingCities.find(c => c.id === selectedCityId);
      if (parentCity && existingAreaCategorySettings) {
        const areaHasSeo = existingAreaCategorySettings.some(s => 
          s.cityName.toLowerCase() === parentCity.name.toLowerCase() &&
          s.areaName.toLowerCase() === itemName.toLowerCase()
        );
        if (areaHasSeo) return true;
      }
    }
    return false;
  };

  // Selection handlers
  const handleToggleItem = (name: string) => {
    if (isItemDisabled(name)) return;
    setSelectedItemNames(prev => 
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const handleSelectAll = () => {
    const activeItems = osmItems.filter(item => !isItemDisabled(item.name));
    setSelectedItemNames(activeItems.map(item => item.name));
  };

  const handleSelectNone = () => {
    setSelectedItemNames([]);
  };

  const handleToggleCategory = (catId: string) => {
    setSelectedCategoryIds(prev => 
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  const filteredOsmItems = useMemo(() => {
    return osmItems.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [osmItems, searchTerm]);

  // Bulk generator write
  const handleBulkGenerate = async () => {
    if (!selectedParentCity) {
      toast({ title: "Validation Error", description: "Select a parent city.", variant: "destructive" });
      return;
    }

    if (selectedItemNames.length === 0) {
      toast({ title: "Validation Error", description: "Select at least one locality.", variant: "destructive" });
      return;
    }

    if (activeTab === 'area-category' && selectedCategoryIds.length === 0) {
      toast({ title: "Validation Error", description: "Select at least one category.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    try {
      const selectedLocations = osmItems.filter(item => selectedItemNames.includes(item.name));
      const total = selectedLocations.length * (activeTab === 'area-category' ? selectedCategoryIds.length : 1);
      setTotalProgress(total);
      setCurrentProgress(0);
      let progressCounter = 0;

      // Single-query pre-fetching map to bypass querying within the loop
      const existingAreaSettingsMap = new Map<string, string>(); // key: cityName_areaName_categoryId -> doc.id
      if (activeTab === 'area-category') {
        const seoRes = await fetch('/api/db/collections?name=areaCategorySeoSettings');
        const seoData = await seoRes.json();
        if (seoData.success && Array.isArray(seoData.data)) {
          seoData.data.forEach((item: any) => {
            if (item.cityName && item.areaName && item.categoryId) {
              existingAreaSettingsMap.set(`${item.cityName.toLowerCase()}_${item.areaName.toLowerCase()}_${item.categoryId}`, item.id);
            }
          });
        }
      }

      // Local state mapping to prevent duplicate parent creation in the same batch
      const locallyCreatedAreas = new Map<string, string>(); // cityId_areaSlug -> areaDocId

      for (let i = 0; i < selectedLocations.length; i++) {
        const loc = selectedLocations[i];
        const slug = loc.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const nearbyStr = getNearbyLocationNames(loc, osmItems, 3);
        const templateIndex = Math.floor(Math.random() * 4);

        // Find or create parent Area in database
        let parentAreaDocId = "";
        const existingArea = existingAreas.find(a => 
          a.cityId === selectedParentCity.id && 
          (a.slug === slug || a.name.toLowerCase() === loc.name.toLowerCase())
        );

        const areaKey = `${selectedParentCity.id}_${slug}`;
        if (existingArea?.id) {
          parentAreaDocId = existingArea.id;
        } else if (locallyCreatedAreas.has(areaKey)) {
          parentAreaDocId = locallyCreatedAreas.get(areaKey)!;
        } else {
          const areaDocId = `area_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
          const areaPayload = {
            id: areaDocId,
            name: loc.name,
            cityId: selectedParentCity.id,
            cityName: selectedParentCity.name,
            slug: slug,
            isActive: true,
            lat: loc.lat,
            lon: loc.lon,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          await fetch('/api/db/collections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ collectionName: 'areas', id: areaDocId, data: areaPayload })
          });
          parentAreaDocId = areaDocId;
          locallyCreatedAreas.set(areaKey, parentAreaDocId);
        }

        if (activeTab === 'manage-areas') {
          // Updating the raw areas collection metadata
          if (existingArea?.id && !overwriteExisting) {
            skippedCount++;
            progressCounter++;
            setCurrentProgress(progressCounter);
            continue;
          }

          const targetAreaId = existingArea?.id || parentAreaDocId;
          const payload = {
            id: targetAreaId,
            name: loc.name,
            cityId: selectedParentCity.id,
            cityName: selectedParentCity.name,
            slug: slug,
            isActive: true,
            lat: loc.lat,
            lon: loc.lon,
            updatedAt: new Date().toISOString()
          };

          if (existingArea?.id) {
            await fetch('/api/db/collections', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ collectionName: 'areas', id: targetAreaId, data: payload })
            });
            updatedCount++;
          } else {
            await fetch('/api/db/collections', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ collectionName: 'areas', id: targetAreaId, data: { ...payload, createdAt: new Date().toISOString() } })
            });
            createdCount++;
          }

          progressCounter++;
          setCurrentProgress(progressCounter);
        } 
        
        else if (activeTab === 'area-category') {
          // Generate Area-Category combination SEO
          const template = AREA_CATEGORY_TEMPLATES[templateIndex];

          for (const catId of selectedCategoryIds) {
            const category = categories.find(c => c.id === catId);
            if (!category) {
              progressCounter++;
              setCurrentProgress(progressCounter);
              continue;
            }

            const categoryName = category.name;
            const categorySlug = category.slug || categoryName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            const combinationSlug = `${selectedParentCity.slug}/${slug}/category/${categorySlug}`;

            // Check if combination already exists from memory
            const existingDocId = existingAreaSettingsMap.get(`${selectedParentCity.name.toLowerCase()}_${loc.name.toLowerCase()}_${catId}`);

            if (existingDocId && !overwriteExisting) {
              skippedCount++;
              progressCounter++;
              setCurrentProgress(progressCounter);
              continue;
            }

            const seo_title = template.title
              .replace(/{cityName}/g, selectedParentCity.name)
              .replace(/{areaName}/g, loc.name)
              .replace(/{categoryName}/g, categoryName)
              .replace(/{nearbyCities}/g, nearbyStr);

            const seo_description = template.description
              .replace(/{cityName}/g, selectedParentCity.name)
              .replace(/{areaName}/g, loc.name)
              .replace(/{categoryName}/g, categoryName)
              .replace(/{nearbyCities}/g, nearbyStr);

            const h1_title = template.h1
              .replace(/{cityName}/g, selectedParentCity.name)
              .replace(/{areaName}/g, loc.name)
              .replace(/{categoryName}/g, categoryName);

            const seo_keywords = generateAreaKeywordsList(selectedParentCity.name, loc.name, categoryName, nearbyStr);

            const targetSeoId = existingDocId || `seo_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
            const payload = {
              id: targetSeoId,
              cityId: selectedParentCity.id,
              cityName: selectedParentCity.name,
              areaId: parentAreaDocId,
              areaName: loc.name,
              categoryId: catId,
              categoryName: categoryName,
              slug: combinationSlug,
              h1_title,
              meta_title: seo_title,
              meta_description: seo_description,
              meta_keywords: seo_keywords,
              isActive: true,
              imageHint: `Local portfolio profiles for verified ${categoryName}s working in ${loc.name}, ${selectedParentCity.name} on screenplaypro.in`,
              updatedAt: new Date().toISOString()
            };

            await fetch('/api/db/collections', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ collectionName: 'areaCategorySeoSettings', id: targetSeoId, data: payload })
            });

            if (existingDocId) {
              updatedCount++;
            } else {
              createdCount++;
            }

            progressCounter++;
            setCurrentProgress(progressCounter);
          }
        }
      }

      // Revalidate cache files
      await triggerRefresh('global-cache');
      await triggerRefresh('sitemap');

      toast({
        title: "Generation Successful",
        description: `Processed ${selectedLocations.length} locations. Created: ${createdCount}, Updated: ${updatedCount}, Skipped: ${skippedCount} entries.`
      });

      onSuccess();
      onClose();

    } catch (err: any) {
      console.error("Area Generation Error:", err);
      toast({
        title: "Generation Failed",
        description: err.message || "An error occurred during bulk generation.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isGenerating && !open && onClose()}>
      <DialogContent className="w-full max-w-xl max-h-[92vh] flex flex-col p-6 rounded-3xl">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            OSM Localities & Area Generator
          </DialogTitle>
          <DialogDescription>
            Automatically query geographical suburbs from OpenStreetMap using distance coordinates, map nearby locations, and randomize unique SEO pages.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow overflow-y-auto py-4 space-y-4 pr-1">
          {/* Global Options */}
          <div className="p-4 border rounded-2xl bg-muted/20 space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Global Settings</h4>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="area-overwrite" className="text-xs font-bold">Overwrite Existing Records</Label>
                <p className="text-[10px] text-muted-foreground">If disabled, existing SEO pages will not be modified.</p>
              </div>
              <Switch 
                id="area-overwrite"
                checked={overwriteExisting} 
                onCheckedChange={setOverwriteExisting} 
              />
            </div>
          </div>

          {/* Phase 1: Inputs and Fetching */}
          {osmItems.length === 0 ? (
            <div className="space-y-4 p-4 border rounded-2xl bg-muted/30">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Compass className="h-4 w-4 text-primary" /> Setup Area Query Filters
              </h3>
              
              <div className="space-y-2">
                <Label htmlFor="area-city-select" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Parent City</Label>
                {existingCities.length === 0 ? (
                  <p className="text-xs text-destructive">No cities registered. Create cities first.</p>
                ) : (
                  <select 
                    id="area-city-select"
                    className="w-full h-10 px-3 border rounded-xl bg-background text-sm font-semibold outline-none focus:ring-2 focus:ring-ring"
                    value={selectedCityId}
                    onChange={(e) => setSelectedCityId(e.target.value)}
                  >
                    {existingCities.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Source Areas From</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input 
                      type="radio" 
                      name="areasSourceDialog" 
                      checked={areasSource === 'db'} 
                      onChange={() => setAreasSource('db')} 
                    />
                    Registered DB Localities
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input 
                      type="radio" 
                      name="areasSourceDialog" 
                      checked={areasSource === 'osm'} 
                      onChange={() => setAreasSource('osm')} 
                    />
                    OpenStreetMap (OSM)
                  </label>
                </div>
              </div>

              {areasSource === 'osm' && (
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Area Scope</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input 
                        type="radio" 
                        name="areaScopeDialog" 
                        checked={areaScope === 'major'} 
                        onChange={() => setAreaScope('major')} 
                      />
                      Major Localities Only
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input 
                        type="radio" 
                        name="areaScopeDialog" 
                        checked={areaScope === 'all'} 
                        onChange={() => setAreaScope('all')} 
                      />
                      All Suburbs & Neighborhoods
                    </label>
                  </div>
                </div>
              )}

              {areasSource === 'osm' && (
                <Button 
                  onClick={handleFetchOsm}
                  className="w-full h-11 font-bold rounded-xl"
                  disabled={isLoadingOsm || existingCities.length === 0}
                >
                  {isLoadingOsm ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Querying OSM mirror...</>
                  ) : (
                    <><Globe className="w-4 h-4 mr-2" /> Fetch Locations</>
                  )}
                </Button>
              )}
            </div>
          ) : (
            // Phase 2: Selection Lists
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-grow">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search localities..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 rounded-xl h-9 text-xs"
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-xl h-9 text-xs"
                  onClick={() => setOsmItems([])}
                >
                  <RefreshCw className="h-3 w-3 mr-1" /> Reset
                </Button>
              </div>

              {/* Category selector for combination tabs */}
              {activeTab === 'area-category' && (
                <div className="space-y-2 p-3 border rounded-2xl bg-muted/20">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Target Categories</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {categories.map(cat => (
                      <div key={cat.id} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`cat-area-${cat.id}`}
                          checked={selectedCategoryIds.includes(cat.id!)}
                          onCheckedChange={() => handleToggleCategory(cat.id!)}
                        />
                        <Label htmlFor={`cat-area-${cat.id}`} className="text-xs font-medium cursor-pointer truncate">{cat.name}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Selection Checkboxes list */}
              <div className="border rounded-2xl overflow-hidden bg-background">
                <div className="flex justify-between items-center bg-muted/40 px-3 py-2 border-b text-xs">
                  <span className="font-bold text-muted-foreground">
                    Selected: {selectedItemNames.length} / {osmItems.length} locations
                  </span>
                  <div className="flex gap-2">
                    <button onClick={handleSelectAll} className="text-primary font-bold hover:underline flex items-center gap-1">
                      <CheckSquare className="h-3 w-3" /> All
                    </button>
                    <button onClick={handleSelectNone} className="text-muted-foreground font-bold hover:underline flex items-center gap-1">
                      <Square className="h-3 w-3" /> None
                    </button>
                  </div>
                </div>

                <div className="max-h-56 overflow-y-auto divide-y">
                  {filteredOsmItems.length === 0 ? (
                    <div className="text-center p-6 text-xs text-muted-foreground">No matching localities found.</div>
                  ) : (
                    filteredOsmItems.map((item, index) => {
                      const isSelected = selectedItemNames.includes(item.name);
                      const isDisabled = isItemDisabled(item.name);
                      return (
                        <div 
                          key={index} 
                          onClick={() => {
                            if (!isDisabled) {
                              handleToggleItem(item.name);
                            }
                          }}
                          className={`flex items-center justify-between p-3 transition-colors text-xs ${
                            isDisabled 
                              ? 'opacity-50 cursor-not-allowed bg-muted/20' 
                              : `hover:bg-muted/40 cursor-pointer ${isSelected ? 'bg-primary/5' : ''}`
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Checkbox 
                              checked={isSelected} 
                              disabled={isDisabled}
                              onCheckedChange={() => {
                                if (!isDisabled) {
                                  handleToggleItem(item.name);
                                }
                              }} 
                            />
                            <div>
                              <p className="font-bold">{item.name}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            {isDisabled ? (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 rounded border-amber-300 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                                Already exists
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[9px] px-1 py-0 rounded flex items-center gap-1">
                                {item.isDbSource ? (
                                  <><Database className="h-2 w-2 text-primary" /> Registered</>
                                ) : (
                                  <>{item.lat.toFixed(2)}°, {item.lon.toFixed(2)}°</>
                                )}
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-4 border-t flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="text-xs text-muted-foreground text-left flex-grow">
            {isGenerating ? (
              <div className="space-y-1.5 w-full">
                <div className="flex justify-between text-xs text-muted-foreground font-bold">
                  <span>Generating: {currentProgress} / {totalProgress} records</span>
                  <span>{totalProgress > 0 ? Math.round((currentProgress / totalProgress) * 100) : 0}%</span>
                </div>
                <Progress value={totalProgress > 0 ? (currentProgress / totalProgress) * 100 : 0} className="h-2 w-full rounded-full animate-pulse" />
              </div>
            ) : (
              selectedItemNames.length > 0 && (
                <p>
                  Will generate <strong className="text-foreground">
                    {selectedItemNames.length * (activeTab === 'area-category' ? selectedCategoryIds.length : 1)}
                  </strong> database records.
                </p>
              )
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose} disabled={isGenerating} className="rounded-xl">
              Cancel
            </Button>
            {osmItems.length > 0 && (
              <Button 
                onClick={handleBulkGenerate}
                disabled={isGenerating || selectedItemNames.length === 0}
                className="rounded-xl font-bold bg-primary hover:bg-primary/95 text-white"
              >
                {isGenerating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> Generate SEO</>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
