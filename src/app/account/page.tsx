"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User, Bell, MessageSquare, LogOut, ChevronRight, Handshake,
  Loader2, Info, FileText, Construction, UserPlus, CreditCard, PhoneCall
} from 'lucide-react';
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import { useLoading } from '@/contexts/LoadingContext';
import { useUnreadNotificationsCount } from '@/hooks/useUnreadNotificationsCount';
import type { ReferralSettings } from '@/types/firestore';
import { cn } from '@/lib/utils';

import ThemeToggle from '@/components/shared/ThemeToggle';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import { useFeaturesConfig } from '@/hooks/useFeaturesConfig';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';

interface AccountLinkProps {
  href: string;
  icon: React.ElementType;
  label: string;
  badgeCount?: number;
  isLogout?: boolean;
}

function AccountPageContent() {
  const { user, firestoreUser, logOut, isLoading: authIsLoading } = useAuth();
  const { showLoading } = useLoading();
  const router = useRouter();
  
  const { count: unreadNotificationsCount } = useUnreadNotificationsCount(user?.uid);
  const [referralSettings, setReferralSettings] = useState<ReferralSettings | null>(null);
  const { config: appConfig, isLoading: isLoadingAppConfig } = useApplicationConfig();
  const { featuresConfig, isLoading: isLoadingFeaturesConfig } = useFeaturesConfig();
  const { settings: globalSettings, isLoading: isLoadingGlobalSettings } = useGlobalSettings();

  useEffect(() => {
    fetch('/api/db/settings?key=referral')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setReferralSettings(data.data as ReferralSettings);
        } else {
          setReferralSettings(null);
        }
      })
      .catch(() => setReferralSettings(null));
  }, []);

  const handleNav = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    showLoading();
    router.push(href);
  };
  
  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    showLoading();
    logOut();
  };

  const AccountLink = ({ href, icon: Icon, label, badgeCount, isLogout = false }: AccountLinkProps) => {
    const action = isLogout ? handleLogout : (e: React.MouseEvent) => handleNav(e, href);

    const content = (
      <div
        className={cn(
          "flex items-center justify-between p-4 rounded-xl transition-all duration-200 cursor-pointer",
          isLogout
            ? "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/40"
            : "bg-card hover:bg-accent border border-border/50 shadow-sm hover:shadow"
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            isLogout ? "bg-red-100 dark:bg-red-900/40" : "bg-muted"
          )}>
            <Icon className="w-5 h-5" />
          </div>
          <span className="font-medium text-sm">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {badgeCount !== undefined && badgeCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-semibold bg-primary text-primary-foreground rounded-full">
              {badgeCount}
            </span>
          )}
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    );

    return action ? (
      <div onClick={action}>{content}</div>
    ) : (
      <Link href={href}>{content}</Link>
    );
  };

  const isInitialLoading = authIsLoading || isLoadingAppConfig || isLoadingFeaturesConfig || isLoadingGlobalSettings;

  if (isInitialLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const displayName = firestoreUser?.displayName || user?.displayName || user?.email?.split('@')[0] || 'User';
  const email = firestoreUser?.email || user?.email || '';

  return (
    <div className="container max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16 border-2 border-primary/20">
            <AvatarImage src={user?.photoURL || undefined} />
            <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary">
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <h1 className="text-xl font-bold">{displayName}</h1>
            <p className="text-sm text-muted-foreground">{email}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
          Account Settings
        </h2>
        <AccountLink href="/profile" icon={User} label="Edit Profile" />
        <AccountLink href="/subscriptions" icon={CreditCard} label="Subscription Plans" />
        <AccountLink href="/notifications" icon={Bell} label="Notifications" badgeCount={unreadNotificationsCount} />
        <AccountLink href="/chat" icon={MessageSquare} label="Support Chat" />
      </div>

      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
          Preferences
        </h2>
        <div className="flex items-center justify-between p-4 bg-card rounded-xl border border-border/50 shadow-sm">
          <span className="font-medium text-sm">Dark Mode</span>
          <ThemeToggle />
        </div>
      </div>

      <div className="pt-2">
        <AccountLink href="#" icon={LogOut} label="Log Out" isLogout />
      </div>
    </div>
  );
}

export default function AccountPage() {
  return (
    <ProtectedRoute>
      <AccountPageContent />
    </ProtectedRoute>
  );
}
