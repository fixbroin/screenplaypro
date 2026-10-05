
"use client";

import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react'; // Added useState
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ADMIN_EMAIL } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase'; // Import db
import { doc, getDoc } from 'firebase/firestore'; // Import Firestore functions
import type { ArtistApplication } from '@/types/firestore'; // Import ArtistApplication type

const Artist_APPLICATION_COLLECTION = "ArtistApplications";

const ProtectedRoute: React.FC<PropsWithChildren> = ({ children }) => {
  const { user, isLoading: authIsLoading, triggerAuthRedirect } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [isArtistApproved, setIsArtistApproved] = useState<boolean | null>(null); // null initially, true/false after check
  const [isCheckingArtistStatus, setIsCheckingArtistStatus] = useState(false);

  useEffect(() => {
    if (authIsLoading) return;

    const isAdminRoute = pathname.startsWith('/admin');
    const isArtistRoute = pathname.startsWith('/artist');
    const isAdminLoginPage = pathname === '/admin/login';
    const isArtistLoginPage = pathname === '/artist/login';
    
    const protectedClientRoutes = [
      '/profile', '/my-bookings', '/checkout/schedule', '/checkout/address',
      '/checkout/payment', '/checkout/thank-you', '/notifications', '/chat', '/cart', '/my-address',
      '/custom-service'
    ];
    const isExplicitlyProtectedClientRoute = protectedClientRoutes.some(route => pathname.startsWith(route));

    const checkArtistApproval = async (userId: string) => {
      setIsCheckingArtistStatus(true);
      try {
        const appDocRef = doc(db, Artist_APPLICATION_COLLECTION, userId);
        const docSnap = await getDoc(appDocRef);
        if (docSnap.exists() && docSnap.data()?.status === 'approved') {
          setIsArtistApproved(true);
        } else {
          setIsArtistApproved(false);
          if (isArtistRoute && pathname !== '/artist-registration' && !isArtistLoginPage) { // Only toast/redirect if trying to access Artist panel
             toast({ title: "Access Denied", description: "Your Artist application is not approved or found.", variant: "destructive" });
             router.push('/artist/login');
          }
        }
      } catch (error) {
        console.error("Error checking Artist status:", error);
        setIsArtistApproved(false);
        if (isArtistRoute && pathname !== '/artist-registration' && !isArtistLoginPage) {
            toast({ title: "Error", description: "Could not verify Artist status.", variant: "destructive" });
            router.push('/artist/login');
        }
      } finally {
        setIsCheckingArtistStatus(false);
      }
    };

    if (!user) { // User is not logged in
      if (isAdminRoute && !isAdminLoginPage) {
        triggerAuthRedirect(pathname);
      } else if (isArtistRoute && pathname !== '/artist-registration' && !isArtistLoginPage) { // Artist registration is a public-ish page (needs login for steps > 0)
        router.push(`/artist/login?redirect=${encodeURIComponent(pathname)}`);
      } else if (isExplicitlyProtectedClientRoute) {
        triggerAuthRedirect(pathname);
      }
    } else { // User is logged in
      if (isAdminRoute) {
        if (user.email !== ADMIN_EMAIL) {
          toast({ title: "Access Denied", description: "You are not authorized for the admin panel.", variant: "destructive" });
          router.push('/');
        }
      } else if (isAdminLoginPage && user.email === ADMIN_EMAIL) {
        router.push('/admin');
      } else if (isAdminLoginPage && user.email !== ADMIN_EMAIL) {
        toast({ title: "Access Denied", description: "Admin login is for administrators only.", variant: "destructive"});
        router.push('/');
      } else if (isArtistRoute) {
        // If it's a Artist route, check their application status
        if (isArtistApproved === null && !isCheckingArtistStatus) { // Check only if not already checked or checking
            checkArtistApproval(user.uid);
        }
      }
    }
  }, [user, authIsLoading, router, pathname, toast, triggerAuthRedirect, isArtistApproved, isCheckingArtistStatus]);

  if (authIsLoading || (pathname.startsWith('/artist') && pathname !== '/artist/login' && isCheckingArtistStatus && isArtistApproved === null)) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // Further checks after loading states are resolved
  if (!user) {
    if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
      return (
        <div className="flex justify-center items-center min-h-screen">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-2">Redirecting to Login...</p>
        </div>
      );
    }
    if (pathname.startsWith('/artist') && pathname !== '/artist-registration' && pathname !== '/artist/login') {
      return (
        <div className="flex justify-center items-center min-h-screen">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-2">Redirecting to Artist Login...</p>
        </div>
      );
    }
    const protectedClientRoutes = [
      '/profile', '/my-bookings', '/checkout/schedule', '/checkout/address',
      '/checkout/payment', '/checkout/thank-you', '/notifications', '/chat', '/cart', '/my-address',
      '/custom-service'
    ];
    if (protectedClientRoutes.some(route => pathname.startsWith(route))) {
      return (
        <div className="flex justify-center items-center min-h-screen">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-2">Redirecting...</p>
        </div>
      );
    }
  } else if (user.email !== ADMIN_EMAIL && pathname.startsWith('/admin') && pathname !== '/admin/login') {
      return <div className="flex justify-center items-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-2">Unauthorized. Redirecting...</p></div>;
  } else if (pathname.startsWith('/artist') && pathname !== '/artist-registration' && pathname !== '/artist/login' && !isArtistApproved) {
      // If on a Artist route (not registration) and not approved (and done checking)
      // This also serves as a fallback if the useEffect redirect hasn't completed
      return <div className="flex justify-center items-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-destructive" /><p className="ml-2">Access Denied to Artist Panel.</p></div>;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

