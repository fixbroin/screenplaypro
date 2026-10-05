"use client";

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Home, FileText, CreditCard, UserCircle as UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useLoading } from '@/contexts/LoadingContext';
import { useFeaturesConfig } from '@/hooks/useFeaturesConfig';
import { useState, useEffect } from 'react';
import type { ReferralSettings } from '@/types/firestore';
import type { ElementType } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: ElementType;
  isProtected: boolean;
  condition?: () => boolean;
}

const BottomNavigationBar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, triggerAuthRedirect } = useAuth();
  const { showLoading } = useLoading();
  const { featuresConfig } = useFeaturesConfig();
  
  const [referralSettings, setReferralSettings] = useState<ReferralSettings | null>(null);

  useEffect(() => {
      if (!user) return;
      
      fetch('/api/db/settings?key=referral')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data) {
            setReferralSettings(data.data as ReferralSettings);
          }
        })
        .catch(() => {});
  }, [user]);

  const navItems: NavItem[] = [
    { href: '/', label: 'Home', icon: Home, isProtected: false },
    { href: '/script-writing', label: 'Scripts', icon: FileText, isProtected: false },
    { href: '/subscriptions', label: 'Plans', icon: CreditCard, isProtected: false },
    { href: '/profile', label: 'Profile', icon: UserIcon, isProtected: true },
  ];

  const handleNav = (e: React.MouseEvent<HTMLAnchorElement>, item: NavItem) => {
    e.preventDefault();
    if (pathname !== item.href) {
      showLoading();
    }
    if (item.isProtected && !user) {
      triggerAuthRedirect(item.href);
    } else {
      router.push(item.href);
    }
  };

  const filteredNavItems = navItems.filter(item => item.condition ? item.condition() : true);

  return (
    <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-background/95 backdrop-blur-lg border-t border-border/50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-40 pb-safe">
      <div className="container mx-auto flex justify-around items-center h-16 px-2">
        {filteredNavItems.map((item) => {
          const isActive = pathname === item.href;
          const IconComponent = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={(e) => handleNav(e, item)}
              className={cn(
                "flex flex-col items-center justify-center min-w-[64px] h-14 rounded-2xl transition-all duration-300",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground active:bg-muted active:scale-95"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-xl transition-transform duration-300",
                isActive ? "scale-110" : ""
              )}>
                <IconComponent className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={cn(
                "text-[10px] font-bold uppercase tracking-tighter mt-0.5",
                isActive ? "opacity-100" : "opacity-80"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavigationBar;
