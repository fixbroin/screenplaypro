
"use client";

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tv } from "lucide-react";
import AdsManagementTab from '@/components/admin/features/AdsManagementTab';
import type { FirestoreCategory, FirestoreService } from '@/types/firestore';
import { useToast } from '@/hooks/use-toast';

export default function FeaturesPage() {
  const [categories, setCategories] = useState<FirestoreCategory[]>([]);
  const [services, setServices] = useState<FirestoreService[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingData(true);
      try {
        const [catRes, servRes] = await Promise.all([
          fetch('/api/db/collections?name=adminCategories').then(r => r.json()).catch(() => ({ success: false })),
          fetch('/api/db/collections?name=adminServices').then(r => r.json()).catch(() => ({ success: false }))
        ]);

        if (catRes.success && Array.isArray(catRes.data)) {
          setCategories(catRes.data as FirestoreCategory[]);
        }
        if (servRes.success && Array.isArray(servRes.data)) {
          setServices(servRes.data as FirestoreService[]);
        }
      } catch (error) {
        console.error("Error fetching data for Ads Management:", error);
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchData();
  }, [toast]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <Tv className="mr-2 h-6 w-6 text-primary" /> Homepage Ad Banners & Features
          </CardTitle>
          <CardDescription>
            Configure ad banners and promotional placements across the Screenplay Pro platform.
          </CardDescription>
        </CardHeader>
      </Card>

      <AdsManagementTab
        allCategories={categories}
        allServices={services}
        isLoadingPrerequisites={isLoadingData}
      />
    </div>
  );
}
