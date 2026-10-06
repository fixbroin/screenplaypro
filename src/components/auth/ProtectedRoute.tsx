"use client";

import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ADMIN_EMAIL } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ProtectedRoute: React.FC<PropsWithChildren> = ({ children }) => {
  const { user, isLoading: authIsLoading, triggerAuthRedirect } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  useEffect(() => {
    if (authIsLoading) return;

    const isAdminRoute = pathname.startsWith('/admin');
    const isAdminLoginPage = pathname === '/admin/login';
    
    const protectedClientRoutes = [
      '/profile', '/my-bookings', '/checkout/schedule', '/checkout/address',
      '/checkout/payment', '/checkout/thank-you', '/notifications', '/chat', '/cart', '/my-address',
      '/custom-service'
    ];
    const isExplicitlyProtectedClientRoute = protectedClientRoutes.some(route => pathname.startsWith(route));

    if (!user) { // User is not logged in
      if (isAdminRoute && !isAdminLoginPage) {
        triggerAuthRedirect(pathname);
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
      }
    }
  }, [user, authIsLoading, router, pathname, toast, triggerAuthRedirect]);

  if (authIsLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
      return (
        <div className="flex justify-center items-center min-h-screen">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-2">Redirecting to Login...</p>
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
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Unauthorized. Redirecting...</p>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
