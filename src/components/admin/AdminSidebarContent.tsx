
"use client"

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import Logo from '@/components/shared/Logo';
import { LayoutGrid, List, Layers, Settings, Users, ShoppingBag, Tag, BarChart3, PlaySquare, Settings2, HelpCircle, MessageSquare, ListChecks, Percent, UserCircle as UserProfileIcon, Target, Map, HandCoins, Megaphone, Bell, Activity, Palette, MessageCircle as ChatIcon, Mail, Zap, Receipt, Tv, Users2, MapPin, Cookie, Globe2, KeyRound, Database, FileText, Construction, Handshake, Banknote, ChevronRight, RefreshCw, CreditCard, Trash2 } from 'lucide-react';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';
import { useLoading } from '@/contexts/LoadingContext';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useState, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutGrid },
  { href: '/admin/profile', label: 'Admin Profile', icon: UserProfileIcon },
  { href: '/admin/notifications', label: 'Admin Notifications', icon: Bell },
  { href: '/admin/activity-feed', label: 'Activity Feed', icon: Activity },
  { href: '/admin/visitor-info', label: 'Visitor Info', icon: Globe2 },
  { type: 'separator', label: 'Core Management' },
  { href: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { href: '/admin/delete-requests', label: 'Delete Requests', icon: Trash2 },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/inquiries', label: 'Inquiries', icon: Mail },
  { href: '/admin/chat', label: 'Chat Management', icon: ChatIcon },

  { type: 'separator', label: 'Content Management' },
  { href: '/admin/slideshows', label: 'Slideshows', icon: PlaySquare },
  { href: '/admin/blog', label: 'Blog', icon: FileText },
  { href: '/admin/reviews', label: 'Reviews', icon: MessageSquare },
  { href: '/admin/faq', label: 'FAQ', icon: HelpCircle },

  { type: 'separator', label: 'Location & SEO' },
  { href: '/admin/seo-settings', label: 'Global SEO Patterns', icon: Target },
  { href: '/admin/seo-overrides', label: 'Advanced SEO', icon: Zap },
  { href: '/admin/google-indexing', label: 'Google Indexing', icon: Globe2 },

  { type: 'separator', label: 'Homepage & Marketing' },
  { href: '/admin/features', label: 'Homepage Features', icon: Tv },
  { href: '/admin/marketing-settings', label: 'Marketing IDs', icon: Megaphone },
  { href: '/admin/marketing-automation', label: 'Marketing Automation', icon: Megaphone },
  { href: '/admin/newsletter-popups', label: 'Newsletter Popups', icon: Megaphone },
  { href: '/admin/promo-codes', label: 'Promo Codes', icon: Percent },

  { type: 'separator', label: 'System Settings' },
  { href: '/admin/theme-settings', label: 'Theme Settings', icon: Palette },
  { href: '/admin/settings', label: 'App Settings', icon: Settings },
  { href: '/admin/login-settings', label: 'Login Settings', icon: KeyRound },
  { href: '/admin/web-settings', label: 'Web Settings', icon: Settings2 },
  { href: '/admin/cookie-settings', label: 'Cookie Settings', icon: Cookie },
  { href: '/admin/database-tools', label: 'Database Tools', icon: Database },
];

export default function AdminSidebarContent() {
  const pathname = usePathname();
  const { settings: globalSettings } = useGlobalSettings();
  const { isMobile, setOpenMobile } = useSidebar();
  const { showLoading } = useLoading();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const sidebarRef = useRef<HTMLDivElement>(null);

  // Restore scroll position on mount & path changes
  useEffect(() => {
    const savedScroll = sessionStorage.getItem('admin-sidebar-scroll');
    if (savedScroll && sidebarRef.current) {
      sidebarRef.current.scrollTop = parseInt(savedScroll, 10);
    }
  }, [pathname]);

  const saveScrollPosition = () => {
    if (sidebarRef.current) {
      sessionStorage.setItem('admin-sidebar-scroll', sidebarRef.current.scrollTop.toString());
    }
  };

  const handleScroll = () => {
    saveScrollPosition();
  };

  const handleLinkClick = () => {
    saveScrollPosition();
    showLoading();
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleRefreshCache = async () => {
    if (!user) return;
    setIsRefreshing(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/clear-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ tag: 'all' }),
      });

      const result = await response.json();
      if (result.success) {
        toast({
          title: "Cache Cleared",
          description: "Website cache has been completely refreshed.",
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({
        title: "Refresh Failed",
        description: error.message || "Could not clear cache.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const uniqueTopLevelAdminPages = [
    '/admin', '/admin/profile', '/admin/notifications', '/admin/activity-feed',
    '/admin/theme-settings', '/admin/newsletter-popups', '/admin/chat', '/admin/inquiries',
    '/admin/seo-overrides',  '/admin/features',
    '/admin/cookie-settings', 
    '/admin/visitor-info',
    '/admin/login-settings',
    '/admin/database-tools',
    '/admin/blog',
    '/admin/marketing-automation',
    '/admin/marketing-settings', 
    '/admin/reviews',
    '/admin/subscriptions',
    '/admin/google-indexing',
    '/admin/delete-requests',
  ];


  return (
    <>
      <SidebarHeader className="p-2 border-b bg-card">
        <Logo
          logoUrl={globalSettings?.logoUrl}
          websiteName={globalSettings?.websiteName}
          href="/admin"
        />
      </SidebarHeader>
      <SidebarContent ref={sidebarRef} onScroll={handleScroll} className="pb-8">
        <SidebarMenu className="gap-1 px-2 pt-4">
          {navItems.map((item, index) => {
            if (item.type === 'separator') {
              return (
                <div key={`sep-${index}`} className="px-4 py-4 mt-4 mb-1">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-accent uppercase tracking-[0.2em] whitespace-nowrap">{item.label}</span>
                    <div className="h-px w-full bg-accent/20" />
                  </div>
                </div>
              );
            }
            let isActiveRoute = pathname === item.href;
            if (uniqueTopLevelAdminPages.includes(item.href!)) {
                isActiveRoute = pathname === item.href;
            } else if (item.href !== '/admin') {
                isActiveRoute = pathname.startsWith(item.href!);
            }

            const IconComponent = item.icon;

            return (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                tooltip={{ children: item.label, side: 'right', align: 'center' }}
                className={cn(
                  "h-11 transition-all duration-300 rounded-xl px-4 group mb-1 border shadow-sm",
                  isActiveRoute 
                    ? "bg-primary text-primary-foreground font-bold shadow-lg border-primary !opacity-100 hover:bg-primary hover:text-primary-foreground" 
                    : "bg-muted/30 text-slate-700 dark:text-slate-300 hover:bg-muted/60 hover:text-primary hover:translate-x-1 opacity-90 hover:opacity-100 border-border/40 hover:border-primary/20"
                )}
              >
                <Link href={item.href!} onClick={handleLinkClick} className="flex items-center w-full">
                  {IconComponent && <IconComponent className={cn("h-4 w-4 shrink-0 transition-transform duration-300", isActiveRoute ? "text-primary-foreground scale-110" : "text-slate-500 dark:text-slate-400 group-hover:text-primary group-hover:scale-110")} />} 
                  <span className="ml-3 truncate flex-grow">{item.label}</span>
                  {isActiveRoute && <ChevronRight className="h-3 w-3 text-primary-foreground opacity-80" />}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
        </SidebarMenu>

        <div className="px-4 mt-8 mb-4">
            <div className="flex items-center gap-3 mb-4">
                <span className="text-[10px] font-black text-accent uppercase tracking-[0.2em] whitespace-nowrap">Cache Control</span>
                <div className="h-px w-full bg-accent/20" />
            </div>
            <button
                onClick={handleRefreshCache}
                disabled={isRefreshing}
                className="w-full flex items-center h-11 transition-all duration-300 rounded-xl px-4 group bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive hover:text-white shadow-sm disabled:opacity-50"
            >
                <RefreshCw className={cn("h-4 w-4 shrink-0 transition-transform duration-700", isRefreshing && "animate-spin")} />
                <span className="ml-3 truncate font-bold text-sm">Clear System Cache</span>
            </button>
        </div>
      </SidebarContent>
    </>
  );
}

