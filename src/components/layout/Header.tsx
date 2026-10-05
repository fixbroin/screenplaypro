
"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Search, Bell, Menu, X, ShoppingCart, LogOut, UserCircle, Briefcase, Settings2, Moon, Sun, MessageSquare, UserPlus, MapPin as AddressIcon, Construction, Handshake, ChevronDown, CreditCard, FileText, PhoneCall } from 'lucide-react';
import Logo from '@/components/shared/Logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ADMIN_EMAIL } from '@/contexts/AuthContext';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';
import { getCartEntries, type CartEntry } from '@/lib/cartManager';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLoading } from '@/contexts/LoadingContext';
import { useUnreadNotificationsCount } from '@/hooks/useUnreadNotificationsCount';
import ThemeToggle from '@/components/shared/ThemeToggle';
import { useApplicationConfig } from '@/hooks/useApplicationConfig'; 
import { useFeaturesConfig } from '@/hooks/useFeaturesConfig'; // Import new hook
import type { ReferralSettings } from '@/types/firestore';
import { doc, onSnapshot } from "firebase/firestore";
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

const NavLink = ({ href, children, onClick, isButton = false }: { href?: string; children: React.ReactNode; onClick?: (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => void; isButton?: boolean }) => {
  const pathname = usePathname();
  const isActive = href ? pathname === href : false;

  const commonClasses = `block w-full text-left px-4 py-2 text-sm rounded-md hover:bg-accent/10 ${isActive ? 'font-semibold text-primary' : 'text-foreground/80'}`;

  if (isButton || !href) {
    return (
      <SheetClose asChild>
        <button onClick={onClick} className={commonClasses}>
          {children}
        </button>
      </SheetClose>
    );
  }

  return (
    <SheetClose asChild>
      <Link href={href} onClick={onClick} className={commonClasses}>
        {children}
      </Link>
    </SheetClose>
  );
};


const Header = () => {
  const [isSearchPopupOpen, setIsSearchPopupOpen] = useState(false);
  const [showSubscriptionPlans, setShowSubscriptionPlans] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { user, firestoreUser, logOut, isLoading: authIsLoading, triggerAuthRedirect } = useAuth();
  const { settings: globalSettings, isLoading: settingsAreLoading } = useGlobalSettings();
  const { config: appConfig, isLoading: isLoadingAppConfig } = useApplicationConfig(); 
  const { featuresConfig, isLoading: isLoadingFeaturesConfig } = useFeaturesConfig(); 
  const [cartItemCount, setCartItemCount] = useState(0);
  const router = useRouter();
  const { toast } = useToast();
  const currentPathnameFromHook = usePathname();
  const { showLoading } = useLoading();

  const { count: unreadCountFromHook, isLoading: isLoadingCount } = useUnreadNotificationsCount(user?.uid);
  const [headerUnreadCount, setHeaderUnreadCount] = useState(0);
  const [currentThemeForIcon, setCurrentThemeForIcon] = useState<'light' | 'dark'>('light');

  // New state for referral settings
  const [referralSettings, setReferralSettings] = useState<ReferralSettings | null>(null);
  const [isLoadingReferral, setIsLoadingReferral] = useState(true);

  // Fetch referral settings - Only for logged in users to save reads
  useEffect(() => {
      if (!user) {
          setIsLoadingReferral(false);
          return;
      }

      const settingsDocRef = doc(db, "appConfiguration", "referral");
      const unsubscribe = onSnapshot(settingsDocRef, (docSnap) => {
          if (docSnap.exists()) {
              setReferralSettings(docSnap.data() as ReferralSettings);
          } else {
              setReferralSettings(null);
          }
          setIsLoadingReferral(false);
      }, (error) => {
          console.error("Error fetching referral settings:", error);
          setIsLoadingReferral(false);
      });
      return () => unsubscribe();
  }, [user]);


  useEffect(() => {
    setHeaderUnreadCount(unreadCountFromHook);
  }, [unreadCountFromHook]);

  useEffect(() => {
    const getInitialTheme = () => {
        const storedTheme = localStorage.getItem('screenplaypro-theme') as 'light' | 'dark' | null;
        if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme;
        if (typeof window.matchMedia !== 'function') return 'light';
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    };
    if (typeof window !== 'undefined') {
      setCurrentThemeForIcon(getInitialTheme());
    }


    const handleThemeChange = (event?: Event) => {
        const newTheme = (event as CustomEvent)?.detail?.theme || getInitialTheme();
        setCurrentThemeForIcon(newTheme);
    };

    window.addEventListener('themeChanged', handleThemeChange);
    window.addEventListener('storage', (event) => {
        if (event.key === 'screenplaypro-theme') {
            handleThemeChange();
        }
    });

    return () => {
        window.removeEventListener('themeChanged', handleThemeChange);
        window.removeEventListener('storage', (event) => {
            if (event.key === 'screenplaypro-theme') handleThemeChange();
        });
    };
  }, []);


  const updateCartCount = () => {
    const entries = getCartEntries();
    const totalQuantity = entries.reduce((sum, entry) => sum + entry.quantity, 0);
    setCartItemCount(totalQuantity);
  };

  useEffect(() => {
    setIsMounted(true);
    updateCartCount();

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'screenplayproUserCart' || event.key === null) {
        updateCartCount();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const handleAuthRequiredNav = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>, intendedHref: string) => {
    e.preventDefault();
    const currentClientPath = window.location.pathname + window.location.search + window.location.hash;
    if (intendedHref !== currentClientPath && !intendedHref.startsWith('#')) showLoading();
    if (!user) triggerAuthRedirect(intendedHref);
    else router.push(intendedHref);
    if (isMobileMenuOpen) setIsMobileMenuOpen(false);
  };

  const handleSimpleNav = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>, intendedHref: string) => {
    e.preventDefault();
    const currentClientPath = window.location.pathname + window.location.search + window.location.hash;
    if (intendedHref !== currentClientPath && !intendedHref.startsWith('#')) showLoading();
    router.push(intendedHref);
    if (isMobileMenuOpen) setIsMobileMenuOpen(false);
  };

  const handleJoinAsArtist = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // 1. Auth Check
    if (!user) {
        triggerAuthRedirect('/artist-registration');
        return;
    }

    // 2. Admin Settings & Subscription Check
    if (!isLoadingFeaturesConfig && featuresConfig?.isSubscriptionRequired && !firestoreUser?.subscriptionActive) {
        setShowSubscriptionPlans(true);
        return;
    }

    // 3. Proceed
    showLoading();
    router.push('/artist-registration');
    if (isMobileMenuOpen) setIsMobileMenuOpen(false);
  };

  const chatIsEnabled = isMounted && !settingsAreLoading && globalSettings?.isChatEnabled;

  const baseNavItems = [
    { href: '/', label: 'Home', isProtected: false },
    { href: '/script-writing', label: 'Script Writing', isProtected: false },
    { href: '/subscriptions', label: 'Pricing & Plans', isProtected: false },
  ];

  const userSpecificNavItems = [
    { href: '/script-writing', label: 'My Screenplays', icon: FileText, isProtected: true },
    { href: '/profile', label: 'Profile Settings', icon: UserCircle, isProtected: true },
    { href: '/subscriptions', label: 'Subscriptions', icon: CreditCard, isProtected: true },
    { href: '/notifications', label: 'Notifications', icon: Bell, isProtected: true },
    { href: '/chat', label: 'Chat with Support', icon: MessageSquare, condition: () => chatIsEnabled, isProtected: true },
  ];
  
  const guestNavItems = [
      { href: '/auth/login', label: 'Login / Sign Up', isProtected: false }
  ];


  if (!isMounted || settingsAreLoading) {
    return (
      <header className="bg-background/80 backdrop-blur-md shadow-sm sticky top-0 z-50 border-b">
        <div data-hydration-state="skeleton" className="container mx-auto px-4 h-16 grid grid-cols-2 md:grid-cols-header-layout items-center">
          <div className="flex items-center justify-start">
             <div className="h-8 w-24 bg-muted rounded animate-pulse" />
          </div>
          <div className="hidden md:flex justify-center col-start-2">
            <div className="h-8 w-24 bg-muted rounded animate-pulse" />
          </div>
          <div className="flex items-center justify-end gap-2">
             <div className="h-8 w-8 bg-muted rounded-full animate-pulse" />
             <div className="h-8 w-8 bg-muted rounded-full animate-pulse" />
             <div className="h-8 w-8 bg-muted rounded-full animate-pulse" />
          </div>
        </div>
      </header>
    );
  }

  return (
    <>
      <header className="bg-background/95 backdrop-blur-xl shadow-sm sticky top-0 z-50 border-b border-border/40 transition-all duration-300">
        <div data-hydration-state="hydrated" className="container mx-auto px-4 h-16 flex items-center justify-between">
          {/* Left: Desktop Nav / Mobile Logo */}
          <div className="flex items-center gap-8">
             <div className="md:hidden">
                <Logo logoUrl={globalSettings?.logoUrl} websiteName={globalSettings?.websiteName} />
             </div>
            <nav className="hidden md:flex items-center gap-2">
              {baseNavItems.map((item) => (
                 <button
                    key={item.href}
                    onClick={(e) => item.isProtected ? handleAuthRequiredNav(e, item.href) : handleSimpleNav(e, item.href)}
                    className={cn(
                      "px-4 py-2 text-sm font-semibold rounded-full transition-all duration-300",
                      currentPathnameFromHook === item.href 
                        ? "bg-primary text-primary-foreground shadow-md" 
                        : "bg-muted/50 text-foreground/70 hover:bg-primary hover:text-primary-foreground hover:shadow-md"
                    )}
                  >
                  {item.label}
                 </button>
              ))}
            </nav>
          </div>

          {/* Center: Logo (Desktop Only) */}
          <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 transform">
             <Logo logoUrl={globalSettings?.logoUrl} websiteName={globalSettings?.websiteName} />
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              
              
              <div className="hidden sm:block">
                <ThemeToggle />
              </div>

              <Button 
                variant="ghost" 
                size="icon" 
                aria-label="Notifications" 
                onClick={(e) => handleAuthRequiredNav(e, '/notifications')} 
                className="relative rounded-full bg-muted/50 hover:bg-primary hover:text-primary-foreground shadow-none h-10 w-10 transition-all duration-300"
              >
                <Bell className="h-5 w-5" />
                {isMounted && !isLoadingCount && headerUnreadCount > 0 && (
                    <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white border-2 border-background group-hover:border-primary transition-colors">
                      {headerUnreadCount > 9 ? '9+' : headerUnreadCount}
                    </span>
                )}
              </Button>

             
            </div>

            <div className="hidden md:block ml-2">
               {!user && !authIsLoading && (
                 <Button className="rounded-full px-6 font-bold shadow-lg shadow-primary/20" size="sm" onClick={(e) => handleSimpleNav(e, '/auth/login')}>
                   Login
                 </Button>
               )}
               {user && (
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="relative flex items-center gap-1.5 h-10 px-2 rounded-full bg-muted/50 hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-all duration-300 shadow-none group">
                        <div className="h-7 w-7 rounded-full border border-primary/20 p-0 group-hover:border-primary transition-colors overflow-hidden">
                          <Avatar className="h-full w-full">
                            <AvatarImage src={user.photoURL || undefined} alt={firestoreUser?.displayName || user.displayName || user.email || "User"} />
                            <AvatarFallback className="bg-primary/10 text-primary font-bold text-[10px]">{firestoreUser?.displayName?.charAt(0).toUpperCase() || user.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || "U"}</AvatarFallback>
                          </Avatar>
                        </div>
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-64 mt-2 rounded-2xl p-2 shadow-2xl border-border/40" align="end" forceMount>
                      <DropdownMenuLabel className="font-normal p-4">
                        <div className="flex flex-col space-y-2">
                          <p className="text-base font-bold leading-none">{firestoreUser?.displayName || user.displayName || "User"}</p>
                          <p className="text-xs leading-none text-muted-foreground truncate">
                            {user.email}
                          </p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="mx-2" />
                      <div className="py-2">
                        {userSpecificNavItems.filter(item => item.condition ? item.condition() : true).map(item => (
                          <DropdownMenuItem key={item.href} asChild className="rounded-xl px-4 py-3 cursor-pointer group focus:bg-primary focus:text-primary-foreground focus:outline-none ring-0">
                            <Link href={item.href} onClick={(e) => handleAuthRequiredNav(e, item.href)}>
                              <div className="bg-primary/10 p-2 rounded-lg mr-3 text-primary group-focus:text-white group-focus:bg-white/20 transition-all">
                                <item.icon className="h-4 w-4" />
                              </div>
                              <span className="font-medium">{item.label}</span>
                            </Link>
                          </DropdownMenuItem>
                        ))}
                      </div>
                      {user.email === ADMIN_EMAIL && (
                        <>
                          <DropdownMenuSeparator className="mx-2" />
                          <DropdownMenuItem asChild className="rounded-xl px-4 py-3 cursor-pointer group focus:bg-amber-600 focus:text-white focus:outline-none ring-0">
                            <Link href="/admin" onClick={(e) => handleAuthRequiredNav(e, "/admin")}>
                              <div className="bg-amber-500/10 p-2 rounded-lg mr-3 text-amber-600 group-focus:text-white group-focus:bg-white/20 transition-all">
                                <Settings2 className="h-4 w-4" />
                              </div>
                              <span className="font-medium text-amber-600 group-focus:text-white">Admin Control</span>
                            </Link>
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuSeparator className="mx-2" />
                      <DropdownMenuItem onClick={(e) => {e.stopPropagation(); showLoading(); logOut();}} className="rounded-xl px-4 py-3 cursor-pointer text-destructive focus:text-white focus:bg-destructive transition-all group focus:outline-none ring-0">
                        <div className="bg-destructive/10 p-2 rounded-lg mr-3 group-focus:text-white group-focus:bg-white/20 transition-all">
                          <LogOut className="h-4 w-4" />
                        </div>
                        <span className="font-medium">Sign Out</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
               )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
};

export default Header;

