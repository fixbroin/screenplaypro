
"use client";

import Header from './Header';
import Footer from './Footer';
import { usePathname } from 'next/navigation';
import type { PropsWithChildren } from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import PopupDisplayManager from '@/components/shared/PopupDisplayManager';
import GlobalAdminPopup from '@/components/chat/GlobalAdminPopup';
import ReviewSubmissionModal from '@/components/reviews/ReviewSubmissionModal';
import type { FirestoreBooking } from '@/types/firestore';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, limit, doc, updateDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import BottomNavigationBar from './BottomNavigationBar';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import CookieConsentBanner from '@/components/shared/CookieConsentBanner';
import CompleteProfileDialog from '@/components/auth/CompleteProfileDialog';
import PwaInstallButton from '@/components/shared/PwaInstallButton';

const AppLayout: React.FC<PropsWithChildren> = ({ children }) => {
  const pathname = usePathname();
  const [isClientMounted, setIsClientMounted] = useState(false);
  
  const [showFooter, setShowFooter] = useState(true);

  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);

  const { user, isLoading: authIsLoading, isCompletingProfile, pendingUserForProfileCompletion, completeProfileSetup, cancelProfileCompletion } = useAuth();
  const [pendingReviewBooking, setPendingReviewBooking] = useState<FirestoreBooking | null>(null);
  const [isReviewPopupOpen, setIsReviewPopupOpen] = useState(false);

  const isMobile = useIsMobile();
  
  // --- Inactivity Tracker Logic (UPDATED) ---
  const lastActivityTimeRef = useRef<number>(Date.now());
  const lastDbUpdateTimeRef = useRef<number>(Date.now());
  const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const THROTTLE_UPDATE_MS = 2 * 60 * 1000;    // update max every 2 mins when active
  const INACTIVITY_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes inactivity triggers final update

  // Firestore update OR sendBeacon fallback
  const updateUserLastSeen = useCallback(
    async (useBeaconFallback = false) => {
      if (!user) return;

      try {
        // 1) sendBeacon first if closing tab or hidden
        if (useBeaconFallback && navigator.sendBeacon) {
          const payload = JSON.stringify({ uid: user.uid, ts: Date.now() });
          navigator.sendBeacon(
            "/api/mark-last-seen", 
            new Blob([payload], { type: "application/json" })
          );
          lastDbUpdateTimeRef.current = Date.now();
          console.log("sendBeacon lastSeen:", new Date().toISOString());
          return;
        }

        // 2) fallback to Firestore update
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, { lastLoginAt: serverTimestamp() });

        lastDbUpdateTimeRef.current = Date.now();
        console.log("Firestore lastSeen:", new Date().toISOString());
      } catch (err) {
        console.error("Error updating last seen:", err);
      }
    },
    [user]
  );

  // Schedule 5-minute final inactivity timeout
  const scheduleInactivityTimeout = useCallback(() => {
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
    }

    inactivityTimeoutRef.current = setTimeout(() => {
      console.log("Inactive for 5 mins → final update");
      updateUserLastSeen(); // final Firestore write
      inactivityTimeoutRef.current = null;
    }, INACTIVITY_THRESHOLD_MS);
  }, [updateUserLastSeen]);

  // Reset tracker when user is active
  const resetInactivity = useCallback(() => {
    lastActivityTimeRef.current = Date.now();

    // Throttled update (only every 2 minutes)
    if (Date.now() - lastDbUpdateTimeRef.current > THROTTLE_UPDATE_MS) {
      updateUserLastSeen();
    }

    scheduleInactivityTimeout();
  }, [scheduleInactivityTimeout, updateUserLastSeen]);


  // MAIN EFFECT – installs listeners + unload handlers
  useEffect(() => {
    if (!user || typeof window === "undefined") return;

    const activityEvents: (keyof WindowEventMap)[] = [
      "mousemove",
      "click",
      "keydown",
      "scroll",
      "touchstart",
      "touchmove",
    ];

    const onActivity = () => resetInactivity();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        resetInactivity();
      } else {
        // tab hidden → update immediately
        updateUserLastSeen(true);
      }
    };

    const onPageHide = () => {
      updateUserLastSeen(true);
    };

    const onBeforeUnload = () => {
      updateUserLastSeen(true);
    };

    // Add listeners
    activityEvents.forEach((ev) =>
      window.addEventListener(ev, onActivity, { passive: true })
    );
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);

    // Start tracking immediately
    resetInactivity();

    return () => {
      activityEvents.forEach((ev) =>
        window.removeEventListener(ev, onActivity)
      );
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);

      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current);
      }
    };
  }, [user, resetInactivity, updateUserLastSeen]);


  // On route change, count as activity
  useEffect(() => {
    if (user) resetInactivity();
  }, [pathname, user, resetInactivity]);


  useEffect(() => {
    setIsClientMounted(true); 
    const preventRightClick = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', preventRightClick);

    // --- SERVICE WORKER REGISTRATION & STALE SW PURGE ---
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', function() {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (let registration of registrations) {
            if (registration.active && registration.active.scriptURL.includes('sw.js') && !registration.active.scriptURL.includes('firebase-messaging-sw.js')) {
              registration.unregister().then(unregistered => {
                if (unregistered) console.log('Cleaned up stale service worker:', registration.active?.scriptURL);
              });
            }
          }
        });

        navigator.serviceWorker.register('/firebase-messaging-sw.js').then(function(registration) {
          console.log('FCM Service Worker registered with scope: ', registration.scope);
        }, function(err) {
          console.log('FCM Service Worker registration failed: ', err);
        });
      });
    }
    // --- END SERVICE WORKER REGISTRATION ---

    return () => document.removeEventListener('contextmenu', preventRightClick);
  }, []);

  // Global helper to scroll focused input elements into view when mobile keyboard pops up
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleFocusIn = (e: FocusEvent) => {
      if (window.innerWidth >= 768) return;
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        if (target.getAttribute('data-no-scroll') === 'true') return;
        setTimeout(() => {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }, 300);
      }
    };

    const handleViewportResize = () => {
      if (window.innerWidth >= 768) return;
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        if (activeEl.getAttribute('data-no-scroll') === 'true') return;
        activeEl.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    
    const viewport = window.visualViewport;
    if (viewport) {
      viewport.addEventListener('resize', handleViewportResize);
    }

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      if (viewport) {
        viewport.removeEventListener('resize', handleViewportResize);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const controlHeader = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY < lastScrollY.current || currentScrollY < 80) {
        setIsHeaderVisible(true);
      } else {
        setIsHeaderVisible(false);
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', controlHeader, { passive: true });
    return () => {
      window.removeEventListener('scroll', controlHeader);
    };
  }, []);

  useEffect(() => {
    if (isClientMounted) { 
      const currentIsAdminRoute = pathname.startsWith('/admin');
      const currentIsArtistRoute = pathname.startsWith('/artist'); 
      const currentIsAuthRoute = pathname.startsWith('/auth/');
      const currentIsCheckoutRoute = pathname.startsWith('/checkout');
      
      const bottomNavActivePaths = ['/', '/chat', '/notifications', '/profile', '/about-us', '/contact-us', '/terms-and-conditions', 
        '/privacy-policy', '/account', '/subscriptions', '/script-writing'];
      
      const shouldShowBottomNav = isMobile && bottomNavActivePaths.includes(pathname);

      const pathSegments = pathname.split('/').filter(Boolean);
      const isCityAreaCategoryPage = pathSegments.length === 3 && pathSegments[0] !== 'category' && pathSegments[0] !== 'service';
      const isCityCategoryPage = pathSegments.length === 3 && pathSegments[1] === 'category';

      const hideFooterPaths: string[] = ['/kannadasgotlatent'];
      const hideFooterPrefixes = [
        '/category/', 
        '/service/',  
        '/custom-service',
        '/script-writing',
        '/script/',
      ];

      const shouldHideFooterForSpecificPaths = 
        hideFooterPaths.includes(pathname) || 
        hideFooterPrefixes.some(prefix => pathname.startsWith(prefix)) ||
        isCityAreaCategoryPage || isCityCategoryPage;
      
      setShowFooter(
        !currentIsAdminRoute &&
        !currentIsArtistRoute && 
        !currentIsAuthRoute &&
        !currentIsCheckoutRoute &&
        !shouldShowBottomNav && 
        !shouldHideFooterForSpecificPaths      
      );
    }
  }, [pathname, isClientMounted, isMobile]);

  const fetchPendingReview = useCallback(async () => {
    if (user && !authIsLoading && !pendingReviewBooking && !isReviewPopupOpen) {
      try {
        const bookingsRef = collection(db, "bookings");
        const q = query(
          bookingsRef,
          where("userId", "==", user.uid),
          where("status", "==", "Completed"),
          where("isReviewedByCustomer", "==", false),
          limit(1)
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const bookingToReview = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as FirestoreBooking;
          console.log("Pending review found for booking:", bookingToReview.bookingId);
          setPendingReviewBooking(bookingToReview);
          setIsReviewPopupOpen(true);
        } else {
          console.log("No pending reviews found for user:", user.uid);
          setPendingReviewBooking(null);
          setIsReviewPopupOpen(false);
        }
      } catch (error) {
        console.error("Error fetching pending reviews:", error);
      }
    }
  }, [user, authIsLoading, pendingReviewBooking, isReviewPopupOpen]);


  useEffect(() => {
    if (isClientMounted && user && !authIsLoading) {
        const isAuthPage = pathname.startsWith('/auth/');
        const isAdminPage = pathname.startsWith('/admin/');
        const isArtistPage = pathname.startsWith('/artist/');
        if (!isAuthPage && !isAdminPage && !isArtistPage) { 
            fetchPendingReview();
        }
    }
    if (!user && !authIsLoading) {
        setIsReviewPopupOpen(false);
        setPendingReviewBooking(null);
    }
  }, [user, authIsLoading, isClientMounted, pathname, fetchPendingReview]);

  const handleReviewSubmitted = useCallback(() => {
    setIsReviewPopupOpen(false);
    setPendingReviewBooking(null);
    fetchPendingReview(); 
  }, [fetchPendingReview]);

  const isScriptEditor = pathname.startsWith('/script-writing/') || pathname.startsWith('/script/');
  const shouldShowHeader = isClientMounted && !pathname.startsWith('/admin') && !pathname.startsWith('/artist') && !pathname.startsWith('/auth/') && !isScriptEditor;
  const shouldShowNewsletterPopupManager = isClientMounted && !pathname.startsWith('/admin') && !pathname.startsWith('/artist') && !isScriptEditor;
  const shouldShowGlobalAdminPopup = isClientMounted && !pathname.startsWith('/admin') && !pathname.startsWith('/artist') && !isScriptEditor;
  const shouldShowPwaInstallButton = isClientMounted && !pathname.startsWith('/category/') && !pathname.includes('/category/') && !pathname.startsWith('/kannadasgotlatent') && !isScriptEditor;

  const hideFooterPrefixes = [
    '/admin',
    '/artist-registration',
    '/artist/profile',
    '/script-writing/',
    '/script/',
    '/kannadasgotlatent',
  ];
  
  const isHideFooterPath = hideFooterPrefixes.some(prefix => pathname.startsWith(prefix));
  const shouldShowBottomNav = isClientMounted && isMobile && !isHideFooterPath;

  return (
    <div className="flex flex-col min-h-screen">
      {shouldShowHeader && (
       <div data-site-header className={cn(
            "fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ease-in-out",
            isHeaderVisible ? "translate-y-0" : "-translate-y-full"
        )}>
            <Header />
        </div>
      )}
     <main
  className={cn(
    "flex-grow",
    shouldShowBottomNav && "pb-16",
    shouldShowHeader && "pt-[64px]"
  )}
>


        {children}
      </main>
      {showFooter && <Footer />}
      {shouldShowBottomNav && <BottomNavigationBar />}
      {shouldShowNewsletterPopupManager && <PopupDisplayManager />}
      {shouldShowGlobalAdminPopup && <GlobalAdminPopup />}
      {isClientMounted && pendingReviewBooking && (
        <ReviewSubmissionModal
          booking={pendingReviewBooking}
          isOpen={isReviewPopupOpen}
          onReviewSubmitted={handleReviewSubmitted}
        />
      )}
      {isClientMounted && pendingUserForProfileCompletion && (
        <CompleteProfileDialog
            isOpen={isCompletingProfile}
            user={pendingUserForProfileCompletion}
            onSubmit={completeProfileSetup}
            onClose={cancelProfileCompletion}
        />
      )}
      {isClientMounted && <CookieConsentBanner />}
      {shouldShowPwaInstallButton && <PwaInstallButton />}
    </div>
  );
};

export default AppLayout;

