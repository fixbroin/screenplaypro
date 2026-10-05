
"use client";

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tv } from "lucide-react";
import AdsManagementTab from '@/components/admin/features/AdsManagementTab';
import type { FirestoreCategory, FirestoreService } from '@/types/firestore';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
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
        const catQuery = query(collection(db, "adminCategories"), orderBy("name", "asc"));
        const servQuery = query(collection(db, "adminServices"), orderBy("name", "asc"));

        const [catSnap, servSnap] = await Promise.all([
          getDocs(catQuery).catch(() => ({ docs: [] })),
          getDocs(servQuery).catch(() => ({ docs: [] }))
        ]);

        setCategories(catSnap.docs.map(d => ({ id: d.id, ...d.data() } as FirestoreCategory)));
        setServices(servSnap.docs.map(d => ({ id: d.id, ...d.data() } as FirestoreService)));

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
