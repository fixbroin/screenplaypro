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
import { db } from '@/lib/firebase';
import { 
  collection, getDocs, addDoc, updateDoc, doc, Timestamp, query, where, writeBatch 
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { triggerRefresh } from '@/lib/revalidateUtils';
import { Progress } from "@/components/ui/progress";
import type { FirestoreCategory, FirestoreCity, FirestoreArea, CityCategorySeoSetting, AreaCategorySeoSetting } from '@/types/firestore';

interface OsmGeneratorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  categories: FirestoreCategory[];
  existingCities: FirestoreCity[];
  existingAreas: FirestoreArea[];
  existingCityCategorySettings?: CityCategorySeoSetting[];
  existingAreaCategorySettings?: AreaCategorySeoSetting[];
  onSuccess: () => void;
}

// 4 Distinct SEO templates for City-Specific Homepages (/[citySlug])
// Mentioning screenplaypro.in, casting platform purpose, and nearby locations.
const CITY_TEMPLATES = [
  {
    h1: "Hire Actors, Models & Creative Talents in {cityName} on screenplaypro.in",
    title: "Verified Artists & Talents in {cityName} | screenplaypro.in",
    description: "Connect directly with casting directors, actors, models, and singers in {cityName} on screenplaypro.in. Explore vetted creative professionals in {cityName} and nearby areas like {nearbyCities}.",
    keywords: "{cityName} artists, screenplaypro, hire actors {cityName}, models in {cityName}, creative hub {nearbyCities}"
  },
  {
    h1: "Connect with Verified Professionals in {cityName} | screenplaypro.in",
    title: "Best Castings & Creative Talents in {cityName} - screenplaypro.in",
    description: "Discover vetted creative talents in {cityName} for film, photography, and advertising. Book local talent easily across {cityName} and neighbouring areas like {nearbyCities} on screenplaypro.in.",
    keywords: "casting call {cityName}, local models {cityName}, singers {cityName}, screenplaypro booking {nearbyCities}"
  },
  {
    h1: "{cityName} Talent Directory: Hire Artists on screenplaypro.in",
    title: "Top Actors & Models in {cityName} | Directory | screenplaypro.in",
    description: "Find verified actors, singers, and models in {cityName} on screenplaypro.in. Hire the best local creatives for events and media shoots in {cityName} and surrounding {nearbyCities}.",
    keywords: "{cityName} talent agency, hire singers {cityName}, actors {cityName}, screenplaypro directory {nearbyCities}"
  },
  {
    h1: "Cast & Book Vetted Artists in {cityName} - screenplaypro.in",
    title: "Artist Booking & Casting in {cityName} | screenplaypro.in",
    description: "screenplaypro.in helps you hire creative artists in {cityName} for event and film productions. Connect with premium local talents in {cityName} and nearby {nearbyCities}.",
    keywords: "production crew {cityName}, book models {cityName}, talent hub {cityName}, screenplaypro casting {nearbyCities}"
  }
];

// 4 Distinct SEO templates for City-Category combinations (/[citySlug]/category/[categorySlug])
const CITY_CATEGORY_TEMPLATES = [
  {
    h1: "Hire Verified {categoryName}s in {cityName} - screenplaypro.in",
    title: "Best {categoryName}s in {cityName} | Casting & Booking | screenplaypro.in",
    description: "Connect with top verified {categoryName}s in {cityName} on screenplaypro.in. Perfect for casting calls, shoots, and creative projects in {cityName} and nearby {nearbyCities}.",
    keywords: "hire {categoryName} in {cityName}, screenplaypro {cityName}, castings for {categoryName}s, creative hub {nearbyCities}"
  },
  {
    h1: "Top {categoryName}s in {cityName} for Castings & Media Projects | screenplaypro.in",
    title: "{categoryName}s in {cityName} | Vetted Talents | screenplaypro.in",
    description: "Discover professional {categoryName}s in {cityName} on screenplaypro.in. Vetted portfolios ready for film, modeling, and advertising bookings in {cityName} and neighbouring {nearbyCities}.",
    keywords: "casting {categoryName}s {cityName}, screenplaypro.in talent, local {categoryName} {cityName}, {nearbyCities}"
  },
  {
    h1: "Discover Verified {categoryName}s in {cityName} on screenplaypro.in",
    title: "Verified {categoryName}s in {cityName} Directory - screenplaypro.in",
    description: "Browse the ultimate directory of verified {categoryName}s in {cityName} on screenplaypro.in. Book casting calls, modeling assignments, and creative projects in {cityName} and adjacent regions like {nearbyCities}.",
    keywords: "{cityName} {categoryName} talent, hire actor model {cityName}, screenplaypro directory, {nearbyCities}"
  },
  {
    h1: "Hire Local {categoryName}s in {cityName} for Film & Photography | screenplaypro.in",
    title: "Professional {categoryName} Booking in {cityName} | screenplaypro.in",
    description: "Book verified {categoryName}s in {cityName} through screenplaypro.in - the premier local talent network. Direct messaging with creative professionals in {cityName} and nearby {nearbyCities}.",
    keywords: "book {categoryName}s {cityName}, casting hub {cityName}, screenplaypro portfolio, {nearbyCities}"
  }
];

// 4 Distinct SEO templates for Area-Category combinations (/[citySlug]/[areaSlug]/category/[categorySlug])
const AREA_CATEGORY_TEMPLATES = [
  {
    h1: "Hire {categoryName}s in {areaName}, {cityName} - screenplaypro.in",
    title: "Best {categoryName}s in {areaName}, {cityName} | Vetted Talent | screenplaypro",
    description: "Find verified local {categoryName}s in {areaName}, {cityName} on screenplaypro.in. Contact casting-ready talents for local projects near {areaName} and nearby areas like {nearbyCities}.",
    keywords: "{areaName} {categoryName}s, hire {categoryName} {areaName}, casting calls, screenplaypro {nearbyCities}"
  },
  {
    h1: "Top Vetted {categoryName}s in {areaName}, {cityName} | screenplaypro.in",
    title: "Verified {categoryName}s in {areaName}, {cityName} | screenplaypro.in",
    description: "Discover professional local {categoryName}s in {areaName}, {cityName} on screenplaypro.in. Vetted talents available for local shoots and bookings in neighbouring {nearbyCities}.",
    keywords: "creative {categoryName}s {areaName}, {areaName} models, casting, {nearbyCities} creative talent"
  },
  {
    h1: "Connect with {categoryName}s in {areaName}, {cityName} on screenplaypro.in",
    title: "{categoryName} Directory in {areaName}, {cityName} | screenplaypro.in",
    description: "Ultimate portal for hiring verified {categoryName}s in {areaName}, {cityName} on screenplaypro.in. Search casting call opportunities and connect with artists near {areaName} and adjacent {nearbyCities}.",
    keywords: "{areaName} talent, hire {categoryName}s {areaName}, screenplaypro directory, local casting {nearbyCities}"
  },
  {
    h1: "Book Local {categoryName}s in {areaName}, {cityName} - screenplaypro.in",
    title: "Book {categoryName}s in {areaName}, {cityName} | Vetted Portfolios",
    description: "Browse portfolios of local {categoryName}s in {areaName}, {cityName} on screenplaypro.in. Send direct booking invites to actors, models, and singers near {areaName} and adjacent {nearbyCities}.",
    keywords: "{categoryName} booking {areaName}, casting directory {areaName}, screenplaypro profile, local booking {nearbyCities}"
  }
];
// Helper to generate at least 20 rich keywords for city or category pages
const generateKeywordsList = (cityName: string, categoryName?: string, nearbyAreas?: string): string => {
  const parts = [];
  
  if (categoryName) {
    parts.push(
      `${cityName} ${categoryName}s`,
      `hire ${categoryName}s in ${cityName}`,
      `verified ${categoryName}s in ${cityName}`,
      `book ${categoryName}s in ${cityName}`,
      `best ${categoryName}s in ${cityName}`,
      `casting calls for ${categoryName}s in ${cityName}`,
      `${categoryName} auditions ${cityName}`,
      `${cityName} creative talents`,
      `hire local ${categoryName}s`,
      `screenplaypro ${cityName}`,
      `casting directors looking for ${categoryName}s in ${cityName}`,
      `professional ${categoryName} bookings ${cityName}`,
      `entertainment jobs in ${cityName}`,
      `${cityName} talent directory`,
      `portfolio booking for ${categoryName}s in ${cityName}`,
      `production crew ${cityName}`,
      `acting and modeling in ${cityName}`,
      `hire artists in ${cityName}`,
      `screenplaypro.in castings ${cityName}`,
      `casting ready artists ${cityName}`
    );
    if (nearbyAreas) {
      parts.push(
        `${categoryName}s near ${nearbyAreas}`,
        `book local talents in ${nearbyAreas}`,
        `casting options in ${nearbyAreas}`,
        `creative professionals near ${nearbyAreas}`
      );
    }
  } else {
    parts.push(
      `${cityName} artists`,
      `hire talent in ${cityName}`,
      `actors in ${cityName}`,
      `models in ${cityName}`,
      `singers in ${cityName}`,
      `verified talents in ${cityName}`,
      `screenplaypro ${cityName}`,
      `casting directors in ${cityName}`,
      `entertainment hub ${cityName}`,
      `creative professionals in ${cityName}`,
      `auditions in ${cityName}`,
      `production crew hire ${cityName}`,
      `artist directory ${cityName}`,
      `photographers in ${cityName}`,
      `event planners ${cityName}`,
      `media jobs in ${cityName}`,
      `hire local artists in ${cityName}`,
      `talent casting platform ${cityName}`,
      `screenplaypro.in network ${cityName}`,
      `casting calls in ${cityName}`
    );
    if (nearbyAreas) {
      parts.push(
        `artists near ${nearbyAreas}`,
        `creative talent in ${nearbyAreas}`,
        `casting calls around ${nearbyAreas}`,
        `book local talent in ${nearbyAreas}`
      );
    }
  }
  
  return parts.join(", ");
};

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

const COMMON_COUNTRIES = [
  { code: 'IN', name: 'India (Default)' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
];

export default function OsmGeneratorDialog({
  isOpen,
  onClose,
  activeTab,
  categories,
  existingCities: propsExistingCities,
  existingAreas: propsExistingAreas,
  existingCityCategorySettings = [],
  existingAreaCategorySettings = [],
  onSuccess,
}: OsmGeneratorDialogProps) {
  const [fullCities, setFullCities] = useState<FirestoreCity[]>([]);
  const [fullAreas, setFullAreas] = useState<FirestoreArea[]>([]);

  useEffect(() => {
    if (isOpen) {
      const fetchFullDbData = async () => {
        try {
          const [citiesSnap, areasSnap] = await Promise.all([
            getDocs(collection(db, "cities")),
            getDocs(collection(db, "areas"))
          ]);
          const loadedCities = citiesSnap.docs.map(d => ({ ...d.data(), id: d.id } as FirestoreCity));
          loadedCities.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          setFullCities(loadedCities);

          const loadedAreas = areasSnap.docs.map(d => ({ ...d.data(), id: d.id } as FirestoreArea));
          loadedAreas.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
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
  const [countryCode, setCountryCode] = useState('IN');
  const [selectedCityId, setSelectedCityId] = useState('');
  
  // New user options
  const [overwriteExisting, setOverwriteExisting] = useState(true);
  const [cityScope, setCityScope] = useState<'major' | 'all'>('major');
  const [citiesSource, setCitiesSource] = useState<'osm' | 'db'>('db');
  const [areasSource, setAreasSource] = useState<'osm' | 'db'>('db');

  const [isLoadingOsm, setIsLoadingOsm] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [osmItems, setOsmItems] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItemNames, setSelectedItemNames] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [totalProgress, setTotalProgress] = useState(0);

  // Reset local state when dialog is closed/opened
  useEffect(() => {
    if (isOpen) {
      setOsmItems([]);
      setSearchTerm('');
      setSelectedItemNames([]);
      setOverwriteExisting(true);
      setCityScope('major');
      setSelectedCategoryIds(categories.map(c => c.id));
      
      // Default selections depending on tab
      if (activeTab === 'city-category') {
        setCitiesSource('db');
        if (existingCities.length > 0) {
          // If using DB source by default, prepopulate with existing cities immediately
          const dbCitiesMapped = existingCities.map(c => ({
            name: c.name,
            lat: (c as any).lat || 20, // default coordinates if missing
            lon: (c as any).lon || 78,
            population: 0,
            state: '',
            isDbSource: true,
            id: c.id
          }));
          setOsmItems(dbCitiesMapped);
          setSelectedItemNames(dbCitiesMapped.filter(c => !isItemDisabled(c.name)).map(c => c.name));
        }
      } else if (activeTab === 'area-category') {
        setAreasSource('db');
      }

      if (existingCities.length > 0) {
        setSelectedCityId(existingCities[0].id);
      }
    }
  }, [isOpen, categories, existingCities, activeTab]);

  // Sync checklist when citiesSource changes inside city-category
  useEffect(() => {
    if (isOpen && activeTab === 'city-category') {
      if (citiesSource === 'db' && existingCities.length > 0) {
        const dbCitiesMapped = existingCities.map(c => ({
          name: c.name,
          lat: (c as any).lat || 20,
          lon: (c as any).lon || 78,
          population: 0,
          state: '',
          isDbSource: true,
          id: c.id
        }));
        setOsmItems(dbCitiesMapped);
        setSelectedItemNames(dbCitiesMapped.filter(c => !isItemDisabled(c.name)).map(c => c.name));
      } else {
        setOsmItems([]);
        setSelectedItemNames([]);
      }
    }
  }, [citiesSource, existingCities, activeTab, isOpen]);

  // Sync checklist when parent city or areasSource changes inside area-category
  useEffect(() => {
    if (isOpen && (activeTab === 'area-category' || activeTab === 'manage-areas')) {
      if (areasSource === 'db' && selectedCityId) {
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
      } else {
        setOsmItems([]);
        setSelectedItemNames([]);
      }
    }
  }, [areasSource, selectedCityId, existingAreas, activeTab, isOpen]);

  // Deselect disabled items dynamically if overwriteExisting toggle is turned off
  useEffect(() => {
    if (!overwriteExisting && isOpen) {
      setSelectedItemNames(prev => prev.filter(name => !isItemDisabled(name)));
    }
  }, [overwriteExisting, isOpen]);

  // Handle selected city change in Area tabs
  const selectedParentCity = useMemo(() => {
    return existingCities.find(c => c.id === selectedCityId) || null;
  }, [existingCities, selectedCityId]);

  // Fetch from OpenStreetMap
  const handleFetchOsm = async () => {
    setIsLoadingOsm(true);
    setOsmItems([]);
    setSelectedItemNames([]);
    
    try {
      let queryStr = "";
      
      if (activeTab === 'city-homepage' || activeTab === 'city-category') {
        // Fetch cities based on cityScope (Major vs All Cities & Towns)
        const selector = cityScope === 'major' ? 'node["place"="city"]' : 'node["place"~"city|town"]';
        queryStr = `[out:json][timeout:35];area["ISO3166-1"="${countryCode}"]->.searchArea;(${selector}(area.searchArea););out body;`;
      } else if (activeTab === 'manage-areas' || activeTab === 'area-category') {
        if (!selectedParentCity) {
          toast({ title: "Error", description: "Please select a parent city first.", variant: "destructive" });
          setIsLoadingOsm(false);
          return;
        }
        // Fetch suburbs/neighborhoods in specific parent city
        queryStr = `[out:json][timeout:35];area[name="${selectedParentCity.name}"]->.a;(node["place"="suburb"](area.a);node["place"="neighbourhood"](area.a);node["place"="quarter"](area.a););out body;`;
      }

      const OVERPASS_SERVERS = [
        'https://overpass-api.de/api/interpreter',
        'https://lz4.overpass-api.de/api/interpreter',
        'https://z.overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
        'https://overpass.openstreetmap.ru/api/interpreter',
        'https://overpass.osm.ch/api/interpreter'
      ];

      let res: any = null;
      let lastError: any = null;
      
      for (const server of OVERPASS_SERVERS) {
        try {
          const url = `${server}?data=${encodeURIComponent(queryStr)}`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 20000); // 20-second timeout per mirror
          
          res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);
          
          if (res.ok) {
            break; // Success!
          } else {
            console.warn(`OSM Server ${server} returned status: ${res.status}`);
            lastError = new Error(`Status ${res.status}`);
          }
        } catch (err: any) {
          console.warn(`Failed to fetch from OSM mirror ${server}:`, err);
          lastError = err;
        }
      }

      if (!res || !res.ok) {
        throw new Error(`Failed to fetch from all OSM interpreters. Last error: ${lastError?.message || 'unknown'}`);
      }
      
      const data = await res.json();
      const elements = data.elements || [];

      if (elements.length === 0) {
        toast({ title: "No Results", description: "No locations found in OpenStreetMap for this query.", variant: "destructive" });
        setIsLoadingOsm(false);
        return;
      }

      // Parse and clean results
      const parsed = elements
        .map((el: any) => {
          const name = el.tags["name:en"] || el.tags.name;
          const population = el.tags.population ? parseInt(el.tags.population, 10) : 0;
          return {
            name,
            lat: el.lat,
            lon: el.lon,
            population,
            state: el.tags["is_in:state"] || el.tags.state || el.tags["addr:state"] || ""
          };
        })
        .filter((item: any) => item.name && item.lat && item.lon);

      // Remove duplicate names if any
      const uniqueMap = new Map<string, any>();
      parsed.forEach((item: any) => {
        if (!uniqueMap.has(item.name.toLowerCase())) {
          uniqueMap.set(item.name.toLowerCase(), item);
        }
      });
      const uniqueList = Array.from(uniqueMap.values());

      // Sort by population descending for cities, or name for suburbs
      if (activeTab === 'city-homepage' || activeTab === 'city-category') {
        uniqueList.sort((a: any, b: any) => b.population - a.population);
      } else {
        uniqueList.sort((a: any, b: any) => a.name.localeCompare(b.name));
      }

      setOsmItems(uniqueList);
      
      // Auto-select top 30 active items by default (excluding already existing items)
      const defaultSelected = uniqueList
        .filter(item => {
          const isDisabled = 
            (activeTab === 'city-homepage' && existingCities.some(c => c.name.toLowerCase() === item.name.toLowerCase())) ||
            ((activeTab === 'city-category' && citiesSource === 'osm') && existingCities.some(c => c.name.toLowerCase() === item.name.toLowerCase()));
          return !isDisabled;
        })
        .slice(0, 30)
        .map(item => item.name);
      setSelectedItemNames(defaultSelected);

      toast({ 
        title: "Fetched Successful", 
        description: `Loaded ${uniqueList.length} locations. Auto-selected top 30.` 
      });

    } catch (error) {
      console.error("OSM Fetch Error:", error);
      toast({ 
        title: "Fetch Failed", 
        description: "Failed to connect to OpenStreetMap server. Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setIsLoadingOsm(false);
    }
  };

  // Helper: Get nearby location names using coordinates distance
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
    if (activeTab === 'city-homepage') {
      return existingCities.some(c => c.name.toLowerCase() === itemName.toLowerCase());
    }
    if (activeTab === 'city-category') {
      if (citiesSource === 'osm') {
        const cityExists = existingCities.some(c => c.name.toLowerCase() === itemName.toLowerCase());
        if (cityExists) return true;
      }
      const cityHasSeo = existingCityCategorySettings.some(s => s.cityName.toLowerCase() === itemName.toLowerCase());
      if (cityHasSeo) return true;
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
      if (parentCity) {
        const areaHasSeo = existingAreaCategorySettings.some(s => 
          s.cityName.toLowerCase() === parentCity.name.toLowerCase() &&
          s.areaName.toLowerCase() === itemName.toLowerCase()
        );
        if (areaHasSeo) return true;
      }
    }
    return false;
  };

  // Select/Deselect triggers
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

  // Filtered items list
  const filteredOsmItems = useMemo(() => {
    return osmItems.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.state && item.state.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [osmItems, searchTerm]);

  // Bulk Generator trigger
  const handleBulkGenerate = async () => {
    if (selectedItemNames.length === 0) {
      toast({ title: "Validation Error", description: "Please select at least one location.", variant: "destructive" });
      return;
    }

    if ((activeTab === 'city-category' || activeTab === 'area-category') && selectedCategoryIds.length === 0) {
      toast({ title: "Validation Error", description: "Please select at least one category.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    try {
      const selectedLocations = osmItems.filter(item => selectedItemNames.includes(item.name));
      const total = selectedLocations.length * ((activeTab === 'city-category' || activeTab === 'area-category') ? selectedCategoryIds.length : 1);
      setTotalProgress(total);
      setCurrentProgress(0);
      let progressCounter = 0;

      // Single-query pre-fetching maps to bypass querying within the loop
      const existingSettingsMap = new Map<string, string>(); // key: cityName_categoryId -> doc.id
      if (activeTab === 'city-category') {
        const snap = await getDocs(collection(db, "cityCategorySeoSettings"));
        snap.forEach(doc => {
          const data = doc.data();
          if (data.cityName && data.categoryId) {
            existingSettingsMap.set(`${data.cityName.toLowerCase()}_${data.categoryId}`, doc.id);
          }
        });
      }

      const existingAreaSettingsMap = new Map<string, string>(); // key: cityName_areaName_categoryId -> doc.id
      if (activeTab === 'area-category') {
        const snap = await getDocs(collection(db, "areaCategorySeoSettings"));
        snap.forEach(doc => {
          const data = doc.data();
          if (data.cityName && data.areaName && data.categoryId) {
            existingAreaSettingsMap.set(`${data.cityName.toLowerCase()}_${data.areaName.toLowerCase()}_${data.categoryId}`, doc.id);
          }
        });
      }

      // Local state mapping to prevent duplicate parent creation in the same batch
      const locallyCreatedCities = new Map<string, string>(); // slug -> cityDocId
      const locallyCreatedAreas = new Map<string, string>(); // cityId_areaSlug -> areaDocId

      // Firestore Write Batch setup
      let batch = writeBatch(db);
      let batchCount = 0;

      for (let i = 0; i < selectedLocations.length; i++) {
        const loc = selectedLocations[i];
        const slug = loc.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const nearbyStr = getNearbyLocationNames(loc, osmItems, 3);
        
        // Pick one of the 4 templates randomly to keep SEO values unique
        const templateIndex = Math.floor(Math.random() * 4);

        if (activeTab === 'city-homepage') {
          // Find if city exists
          const existing = existingCities.find(c => c.slug === slug || c.name.toLowerCase() === loc.name.toLowerCase());
          
          if (existing?.id && !overwriteExisting) {
            skippedCount++;
            progressCounter++;
            setCurrentProgress(progressCounter);
            continue;
          }

          const template = CITY_TEMPLATES[templateIndex];
          const seo_title = template.title.replace(/{cityName}/g, loc.name).replace(/{nearbyCities}/g, nearbyStr);
          const seo_description = template.description.replace(/{cityName}/g, loc.name).replace(/{nearbyCities}/g, nearbyStr);
          const seo_keywords = generateKeywordsList(loc.name, undefined, nearbyStr);
          const h1_title = template.h1.replace(/{cityName}/g, loc.name);

          const payload = {
            name: loc.name,
            slug: slug,
            seo_title,
            seo_description,
            seo_keywords,
            h1_title,
            isActive: true,
            updatedAt: Timestamp.now()
          };

          if (existing?.id) {
            const existingRef = doc(db, "cities", existing.id);
            batch.update(existingRef, payload);
            updatedCount++;
          } else {
            const newRef = doc(collection(db, "cities"));
            batch.set(newRef, {
              ...payload,
              createdAt: Timestamp.now()
            });
            createdCount++;
          }
          
          batchCount++;
          if (batchCount >= 500) {
            await batch.commit();
            await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit buffer to prevent Firestore stream exhaustion
            batch = writeBatch(db);
            batchCount = 0;
          }

          progressCounter++;
          setCurrentProgress(progressCounter);
        } 
        
        else if (activeTab === 'city-category') {
          // Find/create parent city document first to ensure foreign key cityId integrity
          let parentCityDocId = "";
          const existingCity = existingCities.find(c => c.slug === slug || c.name.toLowerCase() === loc.name.toLowerCase());
          
          if (existingCity?.id) {
            parentCityDocId = existingCity.id;
          } else if (locallyCreatedCities.has(slug)) {
            parentCityDocId = locallyCreatedCities.get(slug)!;
          } else {
            // Create the parent city
            const cityTemplate = CITY_TEMPLATES[templateIndex];
            const seo_title = cityTemplate.title.replace(/{cityName}/g, loc.name).replace(/{nearbyCities}/g, nearbyStr);
            const seo_description = cityTemplate.description.replace(/{cityName}/g, loc.name).replace(/{nearbyCities}/g, nearbyStr);
            const seo_keywords = generateKeywordsList(loc.name, undefined, nearbyStr);
            const h1_title = cityTemplate.h1.replace(/{cityName}/g, loc.name);

            const cityPayload = {
              name: loc.name,
              slug: slug,
              seo_title,
              seo_description,
              seo_keywords,
              h1_title,
              isActive: true,
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now()
            };

            const newCityDocRef = doc(collection(db, "cities"));
            batch.set(newCityDocRef, cityPayload);
            parentCityDocId = newCityDocRef.id;
            locallyCreatedCities.set(slug, parentCityDocId);
            batchCount++;
            
            if (batchCount >= 500) {
              await batch.commit();
              await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit buffer to prevent Firestore stream exhaustion
              batch = writeBatch(db);
              batchCount = 0;
            }
          }

          // Generate City-Category SEO Combinations
          const template = CITY_CATEGORY_TEMPLATES[templateIndex];
          
          for (const catId of selectedCategoryIds) {
            const category = categories.find(c => c.id === catId);
            if (!category) {
              progressCounter++;
              setCurrentProgress(progressCounter);
              continue;
            }

            const categoryName = category.name;
            const categorySlug = category.slug || categoryName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            const combinationSlug = `${slug}/category/${categorySlug}`;

            // Check if combination already exists from memory
            const existingDocId = existingSettingsMap.get(`${loc.name.toLowerCase()}_${catId}`);

            if (existingDocId && !overwriteExisting) {
              skippedCount++;
              progressCounter++;
              setCurrentProgress(progressCounter);
              continue;
            }

            const seo_title = template.title
              .replace(/{cityName}/g, loc.name)
              .replace(/{categoryName}/g, categoryName)
              .replace(/{nearbyCities}/g, nearbyStr);

            const seo_description = template.description
              .replace(/{cityName}/g, loc.name)
              .replace(/{categoryName}/g, categoryName)
              .replace(/{nearbyCities}/g, nearbyStr);

            const seo_keywords = generateKeywordsList(loc.name, categoryName, nearbyStr);

            const h1_title = template.h1
              .replace(/{cityName}/g, loc.name)
              .replace(/{categoryName}/g, categoryName);

            const payload = {
              cityId: parentCityDocId,
              cityName: loc.name,
              categoryId: catId,
              categoryName: categoryName,
              slug: combinationSlug,
              h1_title,
              meta_title: seo_title,
              meta_description: seo_description,
              meta_keywords: seo_keywords,
              isActive: true,
              imageHint: `Vibrant portfolio images of ${categoryName}s working in ${loc.name} on screenplaypro.in`,
              updatedAt: Timestamp.now()
            };

            if (existingDocId) {
              const docRef = doc(db, "cityCategorySeoSettings", existingDocId);
              batch.update(docRef, payload);
              updatedCount++;
            } else {
              const newRef = doc(collection(db, "cityCategorySeoSettings"));
              batch.set(newRef, {
                ...payload,
                createdAt: Timestamp.now()
              });
              createdCount++;
            }

            batchCount++;
            if (batchCount >= 500) {
              await batch.commit();
              await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit buffer to prevent Firestore stream exhaustion
              batch = writeBatch(db);
              batchCount = 0;
            }

            progressCounter++;
            setCurrentProgress(progressCounter);
          }
        } 
        
        else if (activeTab === 'manage-areas') {
          if (!selectedParentCity) {
            progressCounter++;
            setCurrentProgress(progressCounter);
            continue;
          }
          
          const existingArea = existingAreas.find(a => 
            a.cityId === selectedParentCity.id && 
            (a.slug === slug || a.name.toLowerCase() === loc.name.toLowerCase())
          );

          if (existingArea?.id && !overwriteExisting) {
            skippedCount++;
            progressCounter++;
            setCurrentProgress(progressCounter);
            continue;
          }

          const payload = {
            name: loc.name,
            cityId: selectedParentCity.id,
            cityName: selectedParentCity.name,
            slug: slug,
            isActive: true,
            updatedAt: Timestamp.now()
          };

          if (existingArea?.id) {
            const existingRef = doc(db, "areas", existingArea.id);
            batch.update(existingRef, payload);
            updatedCount++;
          } else {
            const newRef = doc(collection(db, "areas"));
            batch.set(newRef, {
              ...payload,
              createdAt: Timestamp.now()
            });
            createdCount++;
          }

          batchCount++;
          if (batchCount >= 500) {
            await batch.commit();
            await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit buffer to prevent Firestore stream exhaustion
            batch = writeBatch(db);
            batchCount = 0;
          }

          progressCounter++;
          setCurrentProgress(progressCounter);
        } 
        
        else if (activeTab === 'area-category') {
          if (!selectedParentCity) {
            progressCounter += selectedCategoryIds.length;
            setCurrentProgress(progressCounter);
            continue;
          }

          // Find/create parent Area first to ensure areaId key integrity
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
            // Create Area doc
            const areaPayload = {
              name: loc.name,
              cityId: selectedParentCity.id,
              cityName: selectedParentCity.name,
              slug: slug,
              isActive: true,
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now()
            };
            const newAreaDocRef = doc(collection(db, "areas"));
            batch.set(newAreaDocRef, areaPayload);
            parentAreaDocId = newAreaDocRef.id;
            locallyCreatedAreas.set(areaKey, parentAreaDocId);
            batchCount++;

            if (batchCount >= 500) {
              await batch.commit();
              await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit buffer to prevent Firestore stream exhaustion
              batch = writeBatch(db);
              batchCount = 0;
            }
          }

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

            const seo_keywords = generateAreaKeywordsList(selectedParentCity.name, loc.name, categoryName, nearbyStr);

            const h1_title = template.h1
              .replace(/{cityName}/g, selectedParentCity.name)
              .replace(/{areaName}/g, loc.name)
              .replace(/{categoryName}/g, categoryName);

            const payload = {
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
              imageHint: `Local portfolio profiles for verified ${categoryName}s in ${loc.name}, ${selectedParentCity.name} on screenplaypro.in`,
              updatedAt: Timestamp.now()
            };

            if (existingDocId) {
              const docRef = doc(db, "areaCategorySeoSettings", existingDocId);
              batch.update(docRef, payload);
              updatedCount++;
            } else {
              const newRef = doc(collection(db, "areaCategorySeoSettings"));
              batch.set(newRef, {
                ...payload,
                createdAt: Timestamp.now()
              });
              createdCount++;
            }

            batchCount++;
            if (batchCount >= 500) {
              await batch.commit();
              await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit buffer to prevent Firestore stream exhaustion
              batch = writeBatch(db);
              batchCount = 0;
            }

            progressCounter++;
            setCurrentProgress(progressCounter);
          }
        }
      }

      // Commit remaining batch items
      if (batchCount > 0) {
        await batch.commit();
      }

      // Revalidate cache files
      await triggerRefresh('global-cache');
      await triggerRefresh('sitemap');
      if (activeTab === 'city-homepage') {
        await triggerRefresh('cities');
      }

      toast({
        title: "Generation Successful",
        description: `Successfully processed ${selectedLocations.length} locations. Created: ${createdCount}, Updated: ${updatedCount}, Skipped: ${skippedCount} records.`
      });

      onSuccess();
      onClose();

    } catch (err: any) {
      console.error("Bulk Generation Error:", err);
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
            OSM Bulk SEO Generator
          </DialogTitle>
          <DialogDescription>
            Automatically query boundaries and coordinates from OpenStreetMap, map nearby locations, and randomize unique SEO metadata.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-grow overflow-y-auto py-4 space-y-4 pr-1">
          {/* Global Options */}
          <div className="p-4 border rounded-2xl bg-muted/20 space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Global Settings</h4>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="overwrite-switch" className="text-xs font-bold">Overwrite Existing Records</Label>
                <p className="text-[10px] text-muted-foreground">If disabled, existing SEO pages will not be modified.</p>
              </div>
              <Switch 
                id="overwrite-switch"
                checked={overwriteExisting} 
                onCheckedChange={setOverwriteExisting} 
              />
            </div>
          </div>

          {/* Phase 1: Inputs and Fetching */}
          {osmItems.length === 0 ? (
            <div className="space-y-4 p-4 border rounded-2xl bg-muted/30">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Compass className="h-4 w-4 text-primary" /> Setup Query Filters
              </h3>
              
              {/* City tab options (OSM Only) */}
              {activeTab === 'city-homepage' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="country-select" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Country</Label>
                    <select 
                      id="country-select"
                      className="w-full h-10 px-3 border rounded-xl bg-background text-sm font-semibold outline-none focus:ring-2 focus:ring-ring"
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                    >
                      {COMMON_COUNTRIES.map(c => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">City Filter Scope</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <input 
                          type="radio" 
                          name="cityScope" 
                          checked={cityScope === 'major'} 
                          onChange={() => setCityScope('major')} 
                        />
                        Major Cities Only
                      </label>
                      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <input 
                          type="radio" 
                          name="cityScope" 
                          checked={cityScope === 'all'} 
                          onChange={() => setCityScope('all')} 
                        />
                        All Cities & Towns
                      </label>
                    </div>
                  </div>
                </>
              )}

              {/* City-Category tab options (OSM vs Registered DB Cities) */}
              {activeTab === 'city-category' && (
                <>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Source Cities From</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <input 
                          type="radio" 
                          name="citiesSource" 
                          checked={citiesSource === 'db'} 
                          onChange={() => setCitiesSource('db')} 
                        />
                        Registered DB Cities
                      </label>
                      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <input 
                          type="radio" 
                          name="citiesSource" 
                          checked={citiesSource === 'osm'} 
                          onChange={() => setCitiesSource('osm')} 
                        />
                        OpenStreetMap (OSM)
                      </label>
                    </div>
                  </div>

                  {citiesSource === 'osm' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="country-select-cc" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Country</Label>
                        <select 
                          id="country-select-cc"
                          className="w-full h-10 px-3 border rounded-xl bg-background text-sm font-semibold outline-none focus:ring-2 focus:ring-ring"
                          value={countryCode}
                          onChange={(e) => setCountryCode(e.target.value)}
                        >
                          {COMMON_COUNTRIES.map(c => (
                            <option key={c.code} value={c.code}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">City Filter Scope</Label>
                        <div className="flex gap-4">
                          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                            <input 
                              type="radio" 
                              name="cityScopeCC" 
                              checked={cityScope === 'major'} 
                              onChange={() => setCityScope('major')} 
                            />
                            Major Cities Only
                          </label>
                          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                            <input 
                              type="radio" 
                              name="cityScopeCC" 
                              checked={cityScope === 'all'} 
                              onChange={() => setCityScope('all')} 
                            />
                            All Cities & Towns
                          </label>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Localities & Area-Category tabs options */}
              {(activeTab === 'manage-areas' || activeTab === 'area-category') && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="city-select" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Parent City</Label>
                    {existingCities.length === 0 ? (
                      <p className="text-xs text-destructive">No cities registered. Create cities first.</p>
                    ) : (
                      <select 
                        id="city-select"
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

                  {activeTab === 'area-category' && (
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Source Areas From</Label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                          <input 
                            type="radio" 
                            name="areasSource" 
                            checked={areasSource === 'db'} 
                            onChange={() => setAreasSource('db')} 
                          />
                          Registered DB Localities
                        </label>
                        <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                          <input 
                            type="radio" 
                            name="areasSource" 
                            checked={areasSource === 'osm'} 
                            onChange={() => setAreasSource('osm')} 
                          />
                          OpenStreetMap (OSM)
                        </label>
                      </div>
                    </div>
                  )}
                </>
              )}

              {(activeTab === 'city-homepage' || 
                (activeTab === 'city-category' && citiesSource === 'osm') || 
                activeTab === 'manage-areas' || 
                (activeTab === 'area-category' && areasSource === 'osm')) && (
                <Button 
                  onClick={handleFetchOsm}
                  className="w-full h-11 font-bold rounded-xl"
                  disabled={isLoadingOsm || ((activeTab === 'manage-areas' || activeTab === 'area-category') && existingCities.length === 0)}
                >
                  {isLoadingOsm ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Querying OpenStreetMap...</>
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
                    placeholder="Search locations..."
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
              {(activeTab === 'city-category' || activeTab === 'area-category') && (
                <div className="space-y-2 p-3 border rounded-2xl bg-muted/20">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Target Categories</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {categories.map(cat => (
                      <div key={cat.id} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`cat-${cat.id}`}
                          checked={selectedCategoryIds.includes(cat.id!)}
                          onCheckedChange={() => handleToggleCategory(cat.id!)}
                        />
                        <Label htmlFor={`cat-${cat.id}`} className="text-xs font-medium cursor-pointer truncate">{cat.name}</Label>
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
                    <div className="text-center p-6 text-xs text-muted-foreground">No matching locations found.</div>
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
                              {item.state && <p className="text-[10px] text-muted-foreground">{item.state}</p>}
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
                    {selectedItemNames.length * ((activeTab === 'city-category' || activeTab === 'area-category') ? selectedCategoryIds.length : 1)}
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
