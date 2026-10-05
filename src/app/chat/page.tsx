"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import ChatWindow from "@/components/chat/ChatWindow";
import Breadcrumbs from "@/components/shared/Breadcrumbs";
import type { BreadcrumbItem } from "@/types/ui";
import { Button } from "@/components/ui/button";
import { Home as HomeIcon, ArrowLeft } from "lucide-react";
import { useLoading } from '@/contexts/LoadingContext';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function FullPageChat() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showLoading } = useLoading();
  const withUserId = searchParams.get('with');
  const [otherUserName, setOtherUserName] = useState<string | undefined>(undefined);

  useEffect(() => {
    const fetchOtherUser = async () => {
      if (withUserId) {
        const userDoc = await getDoc(doc(db, "users", withUserId));
        if (userDoc.exists()) {
          setOtherUserName(userDoc.data().displayName || "User");
        }
      }
    };
    fetchOtherUser();
  }, [withUserId]);

  const handleCloseChatWindow = () => {
    showLoading();
    router.back();
  };

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Home", href: "/" },
    { label: withUserId ? (otherUserName || "Chat") : "Support Chat" },
  ];

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 sm:py-10 max-w-4xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div className="space-y-1">
              <Breadcrumbs items={breadcrumbItems} />
              <h1 className="text-3xl sm:text-4xl font-headline font-bold text-foreground tracking-tight">
                {withUserId ? (otherUserName || "Chat") : "Support Chat"}
              </h1>
              <p className="text-muted-foreground text-sm">
                {withUserId ? "Your direct connection" : "We usually respond within a few minutes."}
              </p>
            </div>
            
            <div className="hidden sm:block">
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  showLoading();
                  router.back();
                }}
                className="rounded-full px-6 transition-all duration-300 shadow-lg active:scale-95 font-medium group"
              >
                <ArrowLeft className="mr-2 h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />
                Back
              </Button>
            </div>
          </div>
          
          <div className="h-[calc(100vh-10rem)] sm:h-[calc(100vh-18rem)] relative">
            <ChatWindow 
              onClose={handleCloseChatWindow} 
              otherUserId={withUserId || undefined}
              otherUserName={otherUserName}
            />
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
