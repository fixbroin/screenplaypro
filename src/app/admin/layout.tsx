
"use client";

import type { PropsWithChildren } from 'react';
import React, { Suspense, useEffect, useState, useRef, useCallback, useMemo } from 'react'; 
import { usePathname, useRouter } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import AdminSidebarContent from '@/components/admin/AdminSidebarContent';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/hooks/useAuth';
import { ADMIN_EMAIL } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from '@/components/ui/button';
import { UserCircle, KeyRound, LogOut, Loader2, Bell, ShieldCheck, ChevronDown, Settings2 } from 'lucide-react';
import { auth } from '@/lib/firebase'; 
import { sendPasswordResetEmail } from 'firebase/auth'; 
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useUnreadNotificationsCount } from '@/hooks/useUnreadNotificationsCount';
import { useLoading } from '@/contexts/LoadingContext';
import ThemeToggle from '@/components/shared/ThemeToggle';
import AdminFloatingChatButton from '@/components/admin/AdminFloatingChatButton';
import FloatingAdminChatWindow from '@/components/admin/FloatingAdminChatWindow';
import { useTotalAdminUnreadChatCount } from '@/hooks/useTotalAdminUnreadChatCount';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';
import type { FirestoreNotification } from '@/types/firestore'; 
import { cn } from '@/lib/utils';

const AdminPageLoader = () => (
  <div className="flex justify-center items-center min-h-[calc(100vh-120px)]">
    <Loader2 className="h-10 w-10 animate-spin text-primary" />
    <p className="ml-2 text-muted-foreground font-bold text-xs uppercase">Loading interface...</p>
  </div>
);

export default function AdminLayout({ children }: PropsWithChildren) {
  const { user: adminUser, firestoreUser, isLoading: authIsLoading, logOut: handleLogoutAuth } = useAuth();
  const { toast } = useToast();
  const pathname = usePathname();
  const router = useRouter();
  const { showLoading, hideLoading } = useLoading();
  const [isFloatingChatOpen, setIsFloatingChatOpen] = useState(false);

  // Derived isAdmin check from firestoreUser for better reliability on refresh
  const isAdmin = useMemo(() => {
    return firestoreUser && firestoreUser.email && ADMIN_EMAIL && firestoreUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  }, [firestoreUser]);

  const { count: unreadAdminNotificationsCount, isLoading: isLoadingAdminNotifications } = useUnreadNotificationsCount(adminUser?.uid);

  const { totalUnreadCount, isLoading: isLoadingTotalUnread } = useTotalAdminUnreadChatCount(adminUser?.uid);
  const { settings: globalSettings, isLoading: isLoadingGlobalSettings } = useGlobalSettings();
  const adminChatAudioRef = useRef<HTMLAudioElement | null>(null);
  const previousTotalUnreadCountRef = useRef<number>(0);

  useEffect(() => {
    const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (manifestLink) {
      manifestLink.href = '/manifest-admin.json';
    } else {
      const newManifestLink = document.createElement('link');
      newManifestLink.rel = 'manifest';
      newManifestLink.href = '/manifest-admin.json';
      document.head.appendChild(newManifestLink);
    }
  }, []);

  const handleChangePassword = async () => {
    if (adminUser && adminUser.email) {
      try {
        await sendPasswordResetEmail(auth, adminUser.email);
        toast({ title: "Reset Link Sent", description: "Please check your admin email." });
      } catch (error: any) {
        toast({ title: "Action Failed", description: error.message, variant: "destructive" });
      }
    }
  };

  const navigateToAdminNotifications = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    showLoading();
    router.push('/admin/notifications');
  };

  useEffect(() => {
    return () => {
      hideLoading();
    };
  }, [pathname, adminUser, hideLoading]);


  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  if (authIsLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground font-black text-xs uppercase tracking-widest">Screenplay Pro Admin Secure Load...</p>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <SidebarProvider defaultOpen={true}>
        <Sidebar collapsible="icon" variant="sidebar" className="border-r bg-card text-card-foreground">
          <AdminSidebarContent />
        </Sidebar>
        <SidebarInset className="bg-muted/30 overflow-x-hidden flex flex-col min-h-screen">
          <header className="bg-background/95 backdrop-blur-xl sticky top-0 z-[30] border-b border-border/40 transition-all duration-300 shrink-0">
            <div className="flex h-16 items-center justify-between px-4 sm:px-6">
              <div className="flex items-center gap-4">
                <div className="bg-muted/50 p-1.5 rounded-xl border border-border/40 shadow-sm hover:bg-muted transition-colors cursor-pointer group md:hidden" onClick={() => router.push('/admin')}>
                   <ShieldCheck className="h-5 w-5 text-primary group-hover:scale-110 transition-transform" />
                </div>
                <div className="flex items-center gap-3">
                  <SidebarTrigger className="hidden md:inline-flex rounded-full h-10 w-10 bg-muted/50 hover:bg-primary hover:text-primary-foreground transition-all duration-300" />
                  <div className="flex items-center gap-2">
                    <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-800 dark:text-slate-100">Admin Panel</h1>
                    <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                       <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                       <span className="text-[10px] font-black text-primary uppercase tracking-widest leading-none">Verified</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <ThemeToggle />
                
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative rounded-full h-10 w-10 bg-muted/50 hover:bg-primary hover:text-primary-foreground transition-all duration-300 shadow-none"
                    aria-label="Admin Notifications"
                    onClick={navigateToAdminNotifications}
                  >
                    <Bell className="h-5 w-5" />
                    {!isLoadingAdminNotifications && unreadAdminNotificationsCount > 0 && (
                      <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white border-2 border-background animate-in zoom-in duration-300">
                        {unreadAdminNotificationsCount > 9 ? '9+' : unreadAdminNotificationsCount}
                      </span>
                    )}
                  </Button>
                )}

                {adminUser && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="relative flex items-center gap-2.5 h-11 px-2 pr-3 rounded-full border border-border/40 bg-card hover:bg-muted/50 hover:border-primary/20 transition-all duration-300 shadow-sm group">
                        <Avatar className="h-8 w-8 border-2 border-primary/20 group-hover:border-primary transition-colors">
                          <AvatarImage src={adminUser.photoURL || undefined} alt={adminUser.displayName || adminUser.email || "Admin"} />
                          <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs uppercase">
                            {adminUser.email ? adminUser.email[0] : 'A'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="hidden lg:flex flex-col items-start leading-none gap-1">
                           <span className="text-xs font-black truncate max-w-[100px]">{adminUser.displayName || "Admin"}</span>
                           <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Master</span>
                        </div>
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-64 mt-2 rounded-2xl p-2 shadow-2xl border-border/40 animate-in slide-in-from-top-2 duration-300" align="end" forceMount>
                      <DropdownMenuLabel className="font-normal p-4">
                        <div className="flex items-center gap-3">
                           <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black uppercase shadow-inner border border-primary/10">
                              {adminUser.email ? adminUser.email[0] : 'A'}
                           </div>
                           <div className="flex flex-col space-y-0.5">
                              <p className="text-sm font-black leading-none text-slate-900 dark:text-slate-100">
                                {adminUser.displayName || "Administrator"}
                              </p>
                              <p className="text-[10px] font-medium text-muted-foreground leading-none">
                                {adminUser.email}
                              </p>
                           </div>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="mx-2" />
                      <div className="py-1">
                        <DropdownMenuItem asChild className="rounded-xl px-4 py-2.5 cursor-pointer focus:bg-primary/5 focus:text-primary">
                          <Link href="/admin/profile" onClick={() => showLoading()} className="flex items-center w-full">
                            <div className="p-1.5 bg-primary/10 rounded-lg mr-3 text-primary">
                               <UserCircle className="h-4 w-4" />
                            </div>
                            <span className="font-bold text-xs uppercase tracking-tight">Admin Profile</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleChangePassword} className="rounded-xl px-4 py-2.5 cursor-pointer focus:bg-primary/5 focus:text-primary">
                          <div className="p-1.5 bg-primary/10 rounded-lg mr-3 text-primary">
                             <KeyRound className="h-4 w-4" />
                          </div>
                          <span className="font-bold text-xs uppercase tracking-tight">Change Password</span>
                        </DropdownMenuItem>
                      </div>
                      <DropdownMenuSeparator className="mx-2" />
                      <DropdownMenuItem onClick={() => { showLoading(); handleLogoutAuth(); }} className="rounded-xl px-4 py-2.5 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10">
                        <div className="p-1.5 bg-destructive/10 rounded-lg mr-3">
                           <LogOut className="h-4 w-4" />
                        </div>
                        <span className="font-bold text-xs uppercase tracking-tight">System Logout</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <div className="md:hidden">
                  <SidebarTrigger className="rounded-full h-10 w-10 bg-muted/50" />
                </div>
              </div>
            </div>
          </header>
          <main className="p-4 sm:p-2 lg:p-8 relative flex-grow">
            <Suspense fallback={<AdminPageLoader />}>
              {children}
            </Suspense>
            {isAdmin && (
              <>
                <AdminFloatingChatButton onClick={() => setIsFloatingChatOpen(prev => !prev)} />
                <FloatingAdminChatWindow
                  isOpen={isFloatingChatOpen}
                  onClose={() => setIsFloatingChatOpen(false)}
                />
              </>
            )}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRoute>
  );
}
