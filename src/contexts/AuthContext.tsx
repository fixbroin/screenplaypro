"use client";

import type { PropsWithChildren } from 'react';
import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  type User,
  type AuthError,
  type UserCredential,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  type ConfirmationResult,
  updateEmail, 
  sendEmailVerification, 
  verifyBeforeUpdateEmail,
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { initializeFCM, onForegroundMessage } from '@/lib/fcmUtils';
import { doc, setDoc, Timestamp, getDoc, onSnapshot, collection, query, where, getDocs, limit, runTransaction, writeBatch, or, updateDoc, addDoc, getDocFromServer } from "firebase/firestore";
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { FirestoreUser, MarketingAutomationSettings, ReferralSettings, Referral, FirestoreNotification } from '@/types/firestore';
import { logUserActivity } from '@/lib/activityLogger';
import { getGuestId, clearGuestId } from '@/lib/guestIdManager';
import { sendWelcomeEmail, type WelcomeEmailInput } from '@/ai/flows/sendWelcomeEmailFlow';
import { sendSubscriptionExpiryEmail } from '@/ai/flows/sendSubscriptionExpiryEmailFlow';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import { nanoid } from 'nanoid';
import { syncCartOnLogin } from '@/lib/cartManager';
import { triggerPushNotification } from '@/lib/fcmUtils';
import { incrementSystemStats } from '@/lib/systemStatsUtils';
import { ADMIN_EMAIL } from '@/lib/constants';
export { ADMIN_EMAIL };

export interface SignUpData {
  email: string;
  password: string;
}

export interface LogInData {
  email: string;
  password: string;
}

interface AuthContextType {
  user: User | null;
  firestoreUser: FirestoreUser | null;
  isLoading: boolean;
  authActionRedirectPath: string | null;
  triggerAuthRedirect: (intendedPath: string) => void;
  signUp: (data: SignUpData) => Promise<void>;
  logIn: (data: LogInData) => Promise<void>;
  logOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  handleSuccessfulAuth: (userCredential: UserCredential) => Promise<void>;
  isCompletingProfile: boolean;
  pendingUserForProfileCompletion: User | null;
  completeProfileSetup: (details: { fullName: string; username: string; email?: string; mobileNumber?: string; referralCode?: string }, userOverride?: User) => Promise<void>;
  checkUsernameAvailability: (username: string, excludeUid?: string) => Promise<boolean>;
  generateUsernameSuggestions: (baseName: string) => Promise<string[]>;
  cancelProfileCompletion: () => void;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const generateReferralCode = (length: number) => {
  return nanoid(length).toUpperCase();
};

const getSimpleDeviceId = (): string => {
    if (typeof window === 'undefined') return 'server';
    const { userAgent, hardwareConcurrency, language } = window.navigator;
    const { width, height, colorDepth, pixelDepth } = window.screen;
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    let webglVendor = 'unknown';
    if (gl) {
        const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
            webglVendor = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        }
    }
    const dataString = `${userAgent}|${width}x${height}|${colorDepth}|${pixelDepth}|${hardwareConcurrency}|${language}|${webglVendor}`;
    let hash = 0;
    for (let i = 0; i < dataString.length; i++) {
        const char = dataString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return Math.abs(hash).toString(36);
};


export const AuthProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firestoreUser, setFirestoreUser] = useState<FirestoreUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authActionRedirectPath, setAuthActionRedirectPath] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { config: appConfig, isLoading: isLoadingAppSettings } = useApplicationConfig();

  const [isCompletingProfile, setIsCompletingProfile] = useState(false);
  const [pendingUserForProfileCompletion, setPendingUserForProfileCompletion] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setIsLoading(true);
      if (currentUser) {
        // If it's the admin email, they bypass completeness checks
        if (currentUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
          setUser(currentUser);
          setIsCompletingProfile(false);
          setPendingUserForProfileCompletion(null);
          setIsLoading(false);
          return;
        }

        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(userDocRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data?.isActive === false) {
              await signOut(auth);
              toast({
                title: "Account Disabled",
                description: "Your account has been disabled by the admin.",
                variant: "destructive"
              });
              setUser(null);
              setIsCompletingProfile(false);
              setPendingUserForProfileCompletion(null);
              setIsLoading(false);
              return;
            }

            if (data?.username) {
              // Profile is fully complete
              setUser(currentUser);
              setIsCompletingProfile(false);
              setPendingUserForProfileCompletion(null);
            } else {
              // Profile is incomplete
              console.log("AuthContext: Profile incomplete on auth state change for", currentUser.uid);
              setPendingUserForProfileCompletion(currentUser);
              setIsCompletingProfile(true);
              setUser(null); // Keep user state null so app behaves as logged out/shows login
            }
          } else {
            // Profile doc doesn't exist yet (new registration phase)
            setPendingUserForProfileCompletion(currentUser);
            setIsCompletingProfile(true);
            setUser(null);
          }
        } catch (error) {
          console.error("AuthContext: Error checking profile completeness in onAuthStateChanged:", error);
          // In case of error (e.g. network/offline), fall back to setting the user to prevent lockouts
          setUser(currentUser);
        }
      } else {
        setUser(null);
        setIsCompletingProfile(false);
        setPendingUserForProfileCompletion(null);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user?.uid) {
        const userDocRef = doc(db, 'users', user.uid);
        const unsubscribe = onSnapshot(userDocRef, async (docSnap) => {
            if (docSnap.exists()) {
                const data = { id: docSnap.id, ...docSnap.data() } as FirestoreUser;
                if (data.isActive === false) {
                  await signOut(auth);
                  toast({
                    title: "Account Disabled",
                    description: "Your account has been disabled by the admin.",
                    variant: "destructive"
                  });
                  router.push('/auth/login');
                  return;
                }
                setFirestoreUser(data);

                // Subscription Expiry Check
                if (data.subscriptionActive && data.subscriptionExpiresAt) {
                  const now = Timestamp.now();
                  if (data.subscriptionExpiresAt.toMillis() < now.toMillis()) {
                    // Subscription has expired
                    updateDoc(userDocRef, {
                      subscriptionActive: false,
                      updatedAt: now
                    }).then(() => {
                      toast({ 
                        title: "Subscription Expired", 
                        description: "Your premium plan has expired. Please renew to continue using all features.",
                        variant: "destructive"
                      });

                      // Send Expiry Email
                      if (appConfig?.smtpHost && data.email) {
                        sendSubscriptionExpiryEmail({
                          userName: data.displayName || "User",
                          userEmail: data.email,
                          smtpHost: appConfig.smtpHost, smtpPort: appConfig.smtpPort,
                          smtpUser: appConfig.smtpUser, smtpPass: appConfig.smtpPass, 
                          senderEmail: appConfig.senderEmail,
                        }).catch(err => console.error("Failed to send expiry email:", err));
                      }

                      router.push('/subscriptions?expired=true');
                    });
                  }
                }
            } else {
                setFirestoreUser(null);
            }
        }, (error) => {
            console.error("AuthContext: Error fetching Firestore user data:", error);
            setFirestoreUser(null);
        });
        return () => unsubscribe();
    } else {
        setFirestoreUser(null);
    }
  }, [user, router, toast]);


  const internalTriggerAuthRedirect = useCallback((intendedPath: string) => {
    setAuthActionRedirectPath(intendedPath);
    if (intendedPath.startsWith('/admin')) {
      router.push(`/admin/login?redirect=${encodeURIComponent(intendedPath)}`);
    } else {
      router.push(`/auth/login?redirect=${encodeURIComponent(intendedPath)}`);
    }
  }, [router, setAuthActionRedirectPath]);

  const handleSuccessfulAuth = useCallback(async (userCredential: UserCredential) => {
    setIsLoading(true);
    const guestIdBeforeAuth = getGuestId();
    const { user } = userCredential;
    const providerId = user.providerData[0]?.providerId;
    const isPhoneSignIn = providerId === 'phone' || !!user.phoneNumber || user.providerData.some(p => p.providerId === 'phone');
    const isGoogleSignIn = providerId === 'google.com' || user.providerData.some(p => p.providerId === 'google.com');

    try {
      const userDocRef = doc(db, "users", user.uid);
      
      // Use getDoc (resilient/cached) instead of getDocFromServer (fails on auth token latency)
      let docSnap;
      try {
        docSnap = await getDoc(userDocRef);
      } catch (error) {
        console.warn("AuthContext: getDoc failed, trying getDocFromServer:", error);
        docSnap = await getDocFromServer(userDocRef);
      }

      const userData = docSnap.data();
      
      // Determine completeness considering both Firestore and Auth objects
      const effectiveDisplayName = userData?.displayName || user.displayName;
      const effectiveEmail = userData?.email || user.email;
      const effectiveMobileNumber = userData?.mobileNumber || user.phoneNumber;
      const effectiveUsername = userData?.username;

      console.log("AuthContext: handleSuccessfulAuth debug details:", {
        uid: user.uid,
        exists: docSnap.exists(),
        effectiveDisplayName,
        effectiveMobileNumber,
        effectiveEmail,
        effectiveUsername,
        isPhoneSignIn,
        isGoogleSignIn,
        providerId
      });

      const isComplete = (docSnap.exists() && effectiveUsername) || (user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase());

      if (!isComplete) {
        // If it's an existing user but missing some fields in Firestore that ARE in Auth, sync them
        // We are more lenient here to prevent loops: if they have a username and the current sign-in method's primary data,
        // we try to sync and let them in.
        const hasPrimaryData = isPhoneSignIn ? effectiveMobileNumber : (isGoogleSignIn ? (effectiveEmail && effectiveDisplayName) : (effectiveEmail && effectiveDisplayName));
        
        if (docSnap.exists() && effectiveUsername && hasPrimaryData) {
            console.log("AuthContext: Auto-syncing missing profile data for existing user", user.uid);
            const syncData: Partial<FirestoreUser> = {
                displayName: userData?.displayName || user.displayName || undefined,
                email: userData?.email || user.email || undefined,
                mobileNumber: userData?.mobileNumber || user.phoneNumber || undefined,
                lastLoginAt: Timestamp.now()
            };
            await setDoc(userDocRef, syncData, { merge: true });
            // Continue as existing user flow
        } else {
            console.log("AuthContext: Profile truly incomplete for user", user.uid, {
                exists: docSnap.exists(),
                hasDisplayName: !!effectiveDisplayName,
                hasMobile: !!effectiveMobileNumber,
                hasEmail: !!effectiveEmail,
                hasUsername: !!effectiveUsername
            });
            // NEW USER OR TRULY INCOMPLETE PROFILE FLOW
            setPendingUserForProfileCompletion(user);
            setIsCompletingProfile(true);
            setIsLoading(false);
            return;
        }
      }

      // EXISTING USER FLOW
      await setDoc(userDocRef, { lastLoginAt: Timestamp.now() }, { merge: true });
      logUserActivity('userLogin', {
        email: user.email || undefined,
        mobileNumber: userData?.mobileNumber || user.phoneNumber || undefined,
        loginMethod: user.providerData[0]?.providerId || 'password',
        sourceGuestId: guestIdBeforeAuth
      }, user.uid, null);
      
      clearGuestId();
      await syncCartOnLogin(user.uid);

      toast({ title: "Success", description: "Logged in successfully!" });
      
      setUser(user);
      setIsCompletingProfile(false);
      setPendingUserForProfileCompletion(null);

      const redirectPathFromQuery = searchParams.get('redirect');
      let finalRedirectPath = '/';
      if (user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        finalRedirectPath = '/admin';
      } else if (redirectPathFromQuery && !redirectPathFromQuery.startsWith('/auth/')) {
        finalRedirectPath = redirectPathFromQuery;
      } else if (authActionRedirectPath && !authActionRedirectPath.startsWith('/auth/')) {
        finalRedirectPath = authActionRedirectPath;
      }
      router.push(finalRedirectPath);
      if (authActionRedirectPath) setAuthActionRedirectPath(null);

    } catch (error) {
      const authError = error as AuthError;
      console.error("Post-authentication error:", authError);
      toast({ title: "Authentication Error", description: authError.message || "An error occurred after signing in.", variant: "destructive" });
      throw authError;
    } finally {
      setIsLoading(false);
    }
  }, [router, toast, searchParams, authActionRedirectPath, setAuthActionRedirectPath]);

  const cancelProfileCompletion = useCallback(async () => {
    setIsCompletingProfile(false);
    setPendingUserForProfileCompletion(null);
    await signOut(auth);
    setUser(null);
  }, []);

  const completeProfileSetup = useCallback(async (details: { fullName: string; username: string; email?: string; mobileNumber?: string; referralCode?: string }, userOverride?: User) => {
    const user = userOverride || pendingUserForProfileCompletion;
    if (!user) return;
    setIsLoading(true);
  
    try {
      await updateProfile(user, { displayName: details.fullName });
  
      if (details.email && user.providerData[0]?.providerId === 'phone') {
  const actionCodeSettings = { url: `${window.location.origin}/`, handleCodeInApp: true };

  try {
    await verifyBeforeUpdateEmail(user, details.email, actionCodeSettings);

    toast({
      title: "Verification Email Sent",
      description: `A verification link has been sent to ${details.email}. Please check your inbox to link it to your account.`,
      duration: 3000,
    });

  } catch (error: any) {

    if (error.code === "auth/requires-recent-login") {

      toast({
        title: "Please login again",
        description: "For security reasons please login again before linking your email.",
        variant: "destructive",
      });

      await signOut(auth);
      router.push("/auth/login");
      return;
    }

    throw error;
  }
}
  
      await runTransaction(db, async (transaction) => {
        const referralCodeParam = localStorage.getItem("referralCode") || details.referralCode;
        const referralSettingsDocRef = doc(db, "appConfiguration", "referral");
        const referralSettingsSnap = await transaction.get(referralSettingsDocRef);
        const referralSettings = referralSettingsSnap.exists() ? referralSettingsSnap.data() as ReferralSettings : null;
        let initialWalletBalance = 0;
        let referrerId: string | null = null;
        let deviceId: string | null = null;
        let ipAddress: string | null = null;
        
        const newUsersEmail = details.email || user.email;

        try {
            const ipResponse = await fetch('/api/auth/get-client-ip');
            if (ipResponse.ok) {
                const ipData = await ipResponse.json();
                ipAddress = ipData.ip || null;
            }
        } catch (e) { console.warn("Could not fetch IP address via server API."); }
        if (typeof window !== 'undefined') deviceId = getSimpleDeviceId();

        const newUserDocRef = doc(db, "users", user.uid);
        const existingUserSnap = await transaction.get(newUserDocRef);
        const existingUserData = existingUserSnap.exists() ? existingUserSnap.data() as FirestoreUser : null;
        
        const authProvider = user.providerData[0]?.providerId;
        if (referralCodeParam && referralSettings?.isReferralSystemEnabled && (authProvider === 'google.com' || authProvider === 'phone')) {
          const orConditions = [];
          if (newUsersEmail) orConditions.push(where("referredUserEmail", "==", newUsersEmail));
          if (ipAddress && ipAddress !== 'unknown') orConditions.push(where("ipAddress", "==", ipAddress));
          if (deviceId) orConditions.push(where("deviceId", "==", deviceId));

          let existingReferralSnap = { empty: true };
          if (orConditions.length > 0) {
            const existingReferralQuery = query(collection(db, "referrals"), or(...orConditions), limit(1));
            // Note: transaction.get doesn't support query snapshots directly, but since this is read-only validation, 
            // we'll keep it as a separate check or use regular getDocs if transaction is not strictly required for this part.
            // For now, to keep it within transaction flow, we'll assume the risk or move it out.
            // Actually, existing code had it as a separate check inside transaction which is fine for Firestore.
            existingReferralSnap = await getDocs(existingReferralQuery) as any;
          }
          
          if (existingReferralSnap.empty) {
            const referrerQuery = query(collection(db, "users"), where("referralCode", "==", referralCodeParam), limit(1));
            const referrerSnapshot = await getDocs(referrerQuery);
    
            if (!referrerSnapshot.empty) {
              const referrerDoc = referrerSnapshot.docs[0];
              referrerId = referrerDoc.id;

              if (referrerId !== user.uid) {
                const referredBonus = referralSettings.referredUserBonus || 0;
                if (referredBonus > 0) {
                    initialWalletBalance = referredBonus;
                }
        
                const referralDocRef = doc(collection(db, "referrals"));
                const newReferral: Omit<Referral, 'id'> = {
                    referrerId: referrerId,
                    referredUserId: user.uid,
                    referredUserEmail: newUsersEmail || "N/A",
                    status: 'pending',
                    referrerBonus: referralSettings.referrerBonus || 0,
                    referredBonus: referredBonus,
                    createdAt: Timestamp.now(),
                    ipAddress: ipAddress || "unknown",
                    deviceId: deviceId || "unknown",
                };
                transaction.set(referralDocRef, newReferral);
        
                const referrerNotification: Omit<FirestoreNotification, 'id'> = {
                    userId: referrerId,
                    title: "New Referral Signup!",
                    message: `${details.fullName} has signed up using your link. You'll get your bonus when they complete their first booking.`,
                    type: 'success',
                    href: '/referral',
                    read: false,
                    createdAt: Timestamp.now(),
                };
                transaction.set(doc(collection(db, "userNotifications")), referrerNotification);
              }
            }
          }
        }

        const newUserFirestoreData: Partial<FirestoreUser> = {
          id: user.uid,
          uid: user.uid,
          email: details.email || user.email || existingUserData?.email || null,
          displayName: details.fullName || existingUserData?.displayName,
          username: details.username.toLowerCase() || existingUserData?.username,
          mobileNumber: user.phoneNumber || details.mobileNumber || existingUserData?.mobileNumber || null,
          photoURL: user.photoURL || existingUserData?.photoURL || null,
          isActive: existingUserData?.isActive ?? true,
          lastLoginAt: Timestamp.now(),
        };

        if (!existingUserData) {
          // BRAND NEW USER
          newUserFirestoreData.createdAt = Timestamp.now();
          newUserFirestoreData.walletBalance = initialWalletBalance;
          newUserFirestoreData.referralCode = generateReferralCode(referralSettings?.referralCodeLength || 6);
          if (referrerId) newUserFirestoreData.referredBy = referrerId;
          
          transaction.set(newUserDocRef, newUserFirestoreData as FirestoreUser);
          incrementSystemStats({ totalUsers: 1, newSignups30d: 1 }).catch(e => console.error("Stats increment error:", e));
        } else {
          // COMPLETING EXISTING PROFILE
          transaction.set(newUserDocRef, newUserFirestoreData, { merge: true });
        }
      });
  
      // Trigger SmartSync Revalidation for Admin Stats
      fetch('/api/revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: 'admin-stats' }),
      }).catch(err => console.error("SmartSync revalidation failed:", err));

      const guestIdBeforeAuth = getGuestId();
      logUserActivity('newUser', {
        email: user.email || undefined,
        fullName: details.fullName,
        mobileNumber: user.phoneNumber || details.mobileNumber,
        loginMethod: user.providerData[0]?.providerId || 'unknown',
        sourceGuestId: guestIdBeforeAuth,
        usedReferral: !!localStorage.getItem('referralCode'),
      }, user.uid, null);
      clearGuestId();
      localStorage.removeItem('referralCode');
      
      await syncCartOnLogin(user.uid);
  
      if (appConfig.smtpHost && details.email) {
          sendWelcomeEmail({
              userName: details.fullName,
              userEmail: details.email,
              smtpHost: appConfig.smtpHost, smtpPort: appConfig.smtpPort,
              smtpUser: appConfig.smtpUser, smtpPass: appConfig.smtpPass, senderEmail: appConfig.senderEmail,
          }).catch(err => console.error("Failed to send welcome email:", err));
      }

      const marketingConfigDoc = await getDoc(doc(db, "webSettings", "marketingAutomation"));
      if (marketingConfigDoc.exists()) {
          const marketingConfig = marketingConfigDoc.data() as MarketingAutomationSettings;
          if (marketingConfig?.isWhatsAppEnabled && marketingConfig.whatsAppOnSignup?.enabled && marketingConfig.whatsAppOnSignup.templateName && (user.phoneNumber || details.mobileNumber)) {
              try {
                  await fetch('/api/whatsapp/send', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                          to: user.phoneNumber || details.mobileNumber,
                          templateName: marketingConfig.whatsAppOnSignup.templateName,
                          parameters: [details.fullName, "Screenplay Pro"],
                      }),
                  });
              } catch (waError) {
                  console.error("Failed to trigger welcome WhatsApp message:", waError);
              }
          }
      }
      
      setUser(user);
      setIsCompletingProfile(false);
      setPendingUserForProfileCompletion(null);

      // --- SEND SIGNUP NOTIFICATIONS (Push + In-App) ---
      try {
        // 1. Notify User
        const userNotification: Omit<FirestoreNotification, 'id'> = {
          userId: user.uid,
          title: "Welcome to Screenplay Pro!",
          message: `Hi ${details.fullName}, thank you for joining us! We're excited to help you with your home services.`,
          type: 'success',
          href: '/profile',
          read: false,
          createdAt: Timestamp.now(),
        };
        await setDoc(doc(collection(db, "userNotifications")), userNotification);
        triggerPushNotification({
          userId: user.uid,
          title: userNotification.title,
          body: userNotification.message,
          href: userNotification.href
        }).catch(err => console.error("Error sending user signup push:", err));

        // 2. Notify Admin
        const adminQuery = query(collection(db, "users"), where("email", "==", ADMIN_EMAIL), limit(1));
        const adminSnapshot = await getDocs(adminQuery);
        if (!adminSnapshot.empty) {
          const adminId = adminSnapshot.docs[0].id;
          const adminNotification: Omit<FirestoreNotification, 'id'> = {
            userId: adminId,
            title: "New User Registered!",
            message: `${details.fullName} has just signed up on Screenplay Pro.`,
            type: 'info',
            href: `/admin/users`, // Assuming there's a users management page
            read: false,
            createdAt: Timestamp.now(),
          };
          await setDoc(doc(collection(db, "userNotifications")), adminNotification);
          triggerPushNotification({
            userId: adminId,
            title: adminNotification.title,
            body: adminNotification.message,
            href: adminNotification.href
          }).catch(err => console.error("Error sending admin signup push:", err));
        }
      } catch (notifyError) {
        console.error("Error sending signup notifications:", notifyError);
      }
      // --- END SIGNUP NOTIFICATIONS ---
  
      toast({ title: "Account Created!", description: "Welcome to Screenplay Pro!" });
  
      const redirectPathFromQuery = searchParams.get('redirect');
      let finalRedirectPath = '/';
      if (user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        finalRedirectPath = '/admin';
      } else if (redirectPathFromQuery && !redirectPathFromQuery.startsWith('/auth/')) {
        finalRedirectPath = redirectPathFromQuery;
      } else if (authActionRedirectPath && !authActionRedirectPath.startsWith('/auth/')) {
        finalRedirectPath = authActionRedirectPath;
      }
      router.push(finalRedirectPath);
      if (authActionRedirectPath) setAuthActionRedirectPath(null);
  
    } catch (error) {
      const authError = error as AuthError;
      console.error("Error completing profile setup:", authError);
      toast({ title: "Error", description: authError.message || "Could not save profile details.", variant: "destructive" });
      throw authError;
    } finally {
      setIsLoading(false);
    }
  }, [pendingUserForProfileCompletion, toast, router, searchParams, authActionRedirectPath, appConfig]);
  
  const checkUsernameAvailability = useCallback(async (username: string, excludeUid?: string): Promise<boolean> => {
    if (!username || username.length < 3) return false;
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("username", "==", username.toLowerCase()), limit(1));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) return true;
    
    // If it's the same user, it's available for them
    if (excludeUid && querySnapshot.docs[0].id === excludeUid) return true;
    
    return false;
  }, []);

  const generateUsernameSuggestions = useCallback(async (baseName: string): Promise<string[]> => {
    const base = baseName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
    if (!base) return [];
    
    const suggestions: string[] = [];
    const maxAttempts = 10;
    
    // Helper to check and add suggestion
    const tryAddSuggestion = async (candidate: string) => {
      if (suggestions.length >= 3) return;
      const isAvailable = await checkUsernameAvailability(candidate);
      if (isAvailable && !suggestions.includes(candidate)) {
        suggestions.push(candidate);
      }
    };

    // Try some common patterns
    await tryAddSuggestion(`${base}${Math.floor(Math.random() * 99)}`);
    await tryAddSuggestion(`${base}_${Math.floor(Math.random() * 99)}`);
    await tryAddSuggestion(`${base}${new Date().getFullYear()}`);
    
    // If still need more, try random numbers until we have 3 or hit max attempts
    let currentAttempt = 0;
    while (suggestions.length < 3 && currentAttempt < maxAttempts) {
      await tryAddSuggestion(`${base}${Math.floor(Math.random() * 999)}`);
      currentAttempt++;
    }

    return suggestions;
  }, [checkUsernameAvailability]);

  const signUp = useCallback(async (data: SignUpData) => {
    if (!data.password) {
      toast({ title: "Error", description: "Password is required.", variant: "destructive" });
      throw new Error("Password is required");
    }
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      setPendingUserForProfileCompletion(userCredential.user);
      setIsCompletingProfile(true);
      setIsLoading(false);
    } catch (error) {
      const authError = error as AuthError;
      console.error("Signup error:", authError);
      toast({ title: "Signup Failed", description: authError.message, variant: "destructive" });
      setIsLoading(false);
      throw authError;
    }
  }, [toast]);

  const logIn = useCallback(async (data: LogInData) => {
    if (!data.password) {
      toast({ title: "Error", description: "Password is required.", variant: "destructive" });
      throw new Error("Password is required");
    }
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
      await handleSuccessfulAuth(userCredential);
    } catch (error) {
      const authError = error as AuthError;
      console.error("Login error:", authError);
      toast({ title: "Login Failed", description: authError.message, variant: "destructive" });
      setIsLoading(false);
      throw authError;
    }
  }, [toast, handleSuccessfulAuth]);
  
  const signInWithGoogle = useCallback(async () => {
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      await handleSuccessfulAuth(result);
    } catch (error) {
      const authError = error as AuthError;
      if (authError.code !== 'auth/popup-closed-by-user') {
        console.error("Google Sign-in error:", authError);
        toast({ title: "Google Sign-in Failed", description: authError.message || "Could not sign in with Google.", variant: "destructive" });
      }
      setIsLoading(false); 
      if (authError.code !== 'auth/popup-closed-by-user') {
        throw authError;
      }
    }
  }, [toast, handleSuccessfulAuth]);


  const logOut = useCallback(async () => {
    setIsLoading(true);
    const userIdForLog = user?.uid;
    const userEmailForLog = user?.email;
    try {
      if (userIdForLog) {
        logUserActivity('userLogout', { logoutMethod: 'manual', email: userEmailForLog ?? undefined }, userIdForLog, null);
      }
      await signOut(auth);
      setUser(null);
      setAuthActionRedirectPath(null);
      setIsCompletingProfile(false);
      setPendingUserForProfileCompletion(null);
      toast({ title: "Logged Out", description: "You have been logged out." });
      router.push('/auth/login');
    } catch (error) {
      const authError = error as AuthError;
      console.error("Logout error:", authError);
      toast({ title: "Logout Failed", description: authError.message || "Could not log out.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [router, toast, user]);

  useEffect(() => {
    if (user?.uid) { 
      const setupFCM = async () => {
        try {
          await initializeFCM(user.uid);
          onForegroundMessage();
        } catch (error) {
          console.error("AuthContext: Error setting up FCM:", error);
        }
      };
      setupFCM();
    }
  }, [user]);

  const contextValue: AuthContextType = useMemo(() => {
    return {
      user,
      firestoreUser,
      isLoading,
      authActionRedirectPath,
      triggerAuthRedirect: internalTriggerAuthRedirect,
      signUp,
      logIn,
      logOut,
      signInWithGoogle,
      handleSuccessfulAuth,
      isCompletingProfile,
      pendingUserForProfileCompletion,
      completeProfileSetup,
      checkUsernameAvailability,
      generateUsernameSuggestions,
      cancelProfileCompletion,
      setUser,
    };
  }, [user, firestoreUser, isLoading, authActionRedirectPath, internalTriggerAuthRedirect, signUp, logIn, logOut, signInWithGoogle, handleSuccessfulAuth, isCompletingProfile, pendingUserForProfileCompletion, completeProfileSetup, checkUsernameAvailability, generateUsernameSuggestions, cancelProfileCompletion, setUser]);

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export default AuthContext;

