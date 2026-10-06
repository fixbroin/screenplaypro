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
  verifyBeforeUpdateEmail,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { initializeFCM, onForegroundMessage } from '@/lib/fcmUtils';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { FirestoreUser } from '@/types/firestore';
import { logUserActivity } from '@/lib/activityLogger';
import { getGuestId, clearGuestId } from '@/lib/guestIdManager';
import { sendWelcomeEmail } from '@/ai/flows/sendWelcomeEmailFlow';
import { useApplicationConfig } from '@/hooks/useApplicationConfig';
import { nanoid } from 'nanoid';
import { syncCartOnLogin } from '@/lib/cartManager';
import { ADMIN_EMAIL } from '@/lib/constants';
export { ADMIN_EMAIL };

export interface SignUpData {
  email: string;
  password: string;
  fullName?: string;
  mobileNumber?: string;
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
  completeProfileSetup: (details: { fullName: string; username?: string; email?: string; mobileNumber?: string; referralCode?: string }, userOverride?: User) => Promise<void>;
  checkUsernameAvailability: (username: string, excludeUid?: string) => Promise<boolean>;
  generateUsernameSuggestions: (baseName: string) => Promise<string[]>;
  cancelProfileCompletion: () => void;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const generateReferralCode = (length: number) => {
  return nanoid(length).toUpperCase();
};

export const AuthProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firestoreUser, setFirestoreUser] = useState<FirestoreUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authActionRedirectPath, setAuthActionRedirectPath] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { config: appConfig } = useApplicationConfig();

  const [isCompletingProfile, setIsCompletingProfile] = useState(false);
  const [pendingUserForProfileCompletion, setPendingUserForProfileCompletion] = useState<User | null>(null);

  const fetchMySQLUser = useCallback(async (uid: string): Promise<FirestoreUser | null> => {
    try {
      const res = await fetch(`/api/db/users?userId=${uid}`);
      if (!res.ok) return null;
      const json = await res.json();
      if (json.success && json.user) {
        return json.user as FirestoreUser;
      }
    } catch (err) {
      console.error("AuthContext: Error fetching MySQL user:", err);
    }
    return null;
  }, []);

  const saveMySQLUser = useCallback(async (userData: any): Promise<boolean> => {
    try {
      const res = await fetch('/api/db/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      return res.ok;
    } catch (err) {
      console.error("AuthContext: Error saving user to MySQL:", err);
      return false;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setIsLoading(true);
      if (currentUser) {
        if (currentUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
          setUser(currentUser);
          setIsCompletingProfile(false);
          setPendingUserForProfileCompletion(null);
          setIsLoading(false);
          return;
        }

        const dbUser = await fetchMySQLUser(currentUser.uid);
        if (dbUser) {
          if (dbUser.isActive === false || (dbUser as any).isActive === 0) {
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

          setFirestoreUser(dbUser);
          setUser(currentUser);
          setIsCompletingProfile(false);
          setPendingUserForProfileCompletion(null);
        } else {
          // Auto-create in MySQL
          const newUserData = {
            id: currentUser.uid,
            email: currentUser.email || '',
            displayName: currentUser.displayName || 'User',
            mobileNumber: currentUser.phoneNumber || '',
            photoURL: currentUser.photoURL || '',
            isActive: 1,
            roles: ['user']
          };
          await saveMySQLUser(newUserData);
          setFirestoreUser(newUserData as unknown as FirestoreUser);
          setUser(currentUser);
          setIsCompletingProfile(false);
          setPendingUserForProfileCompletion(null);
        }
      } else {
        setUser(null);
        setFirestoreUser(null);
        setIsCompletingProfile(false);
        setPendingUserForProfileCompletion(null);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [fetchMySQLUser, saveMySQLUser, toast]);

  const internalTriggerAuthRedirect = useCallback((intendedPath: string) => {
    setAuthActionRedirectPath(intendedPath);
    if (intendedPath.startsWith('/admin')) {
      router.push(`/admin/login?redirect=${encodeURIComponent(intendedPath)}`);
    } else {
      router.push(`/auth/login?redirect=${encodeURIComponent(intendedPath)}`);
    }
  }, [router]);

  const handleSuccessfulAuth = useCallback(async (userCredential: UserCredential) => {
    setIsLoading(true);
    const guestIdBeforeAuth = getGuestId();
    const { user } = userCredential;

    try {
      const dbUser = await fetchMySQLUser(user.uid);
      const newUserData = {
        id: user.uid,
        email: user.email || dbUser?.email || '',
        displayName: user.displayName || dbUser?.displayName || 'User',
        mobileNumber: user.phoneNumber || dbUser?.mobileNumber || '',
        photoURL: user.photoURL || dbUser?.photoURL || '',
        isActive: 1,
        roles: ['user']
      };

      await saveMySQLUser(newUserData);
      setFirestoreUser((dbUser ? { ...dbUser, ...newUserData } : newUserData) as unknown as FirestoreUser);

      logUserActivity('userLogin', {
        email: user.email || undefined,
        mobileNumber: user.phoneNumber || undefined,
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
  }, [fetchMySQLUser, saveMySQLUser, router, toast, searchParams, authActionRedirectPath]);

  const cancelProfileCompletion = useCallback(async () => {
    setIsCompletingProfile(false);
    setPendingUserForProfileCompletion(null);
    await signOut(auth);
    setUser(null);
  }, []);

  const completeProfileSetup = useCallback(async (details: { fullName: string; username?: string; email?: string; mobileNumber?: string; referralCode?: string }, userOverride?: User) => {
    const userToUpdate = userOverride || pendingUserForProfileCompletion;
    if (!userToUpdate) return;
    setIsLoading(true);

    try {
      await updateProfile(userToUpdate, { displayName: details.fullName });

      if (details.email && userToUpdate.providerData[0]?.providerId === 'phone') {
        const actionCodeSettings = { url: `${window.location.origin}/`, handleCodeInApp: true };
        try {
          await verifyBeforeUpdateEmail(userToUpdate, details.email, actionCodeSettings);
          toast({
            title: "Verification Email Sent",
            description: `A verification link has been sent to ${details.email}.`,
            duration: 3000,
          });
        } catch (error: any) {
          if (error.code === "auth/requires-recent-login") {
            toast({
              title: "Please login again",
              description: "For security reasons please login again.",
              variant: "destructive",
            });
            await signOut(auth);
            router.push("/auth/login");
            return;
          }
        }
      }

      const newUserData = {
        id: userToUpdate.uid,
        email: details.email || userToUpdate.email || '',
        displayName: details.fullName,
        mobileNumber: userToUpdate.phoneNumber || details.mobileNumber || '',
        photoURL: userToUpdate.photoURL || '',
        isActive: 1,
        roles: ['user']
      };

      await saveMySQLUser(newUserData);
      setFirestoreUser(newUserData as unknown as FirestoreUser);

      const guestIdBeforeAuth = getGuestId();
      logUserActivity('newUser', {
        email: userToUpdate.email || undefined,
        fullName: details.fullName,
        mobileNumber: userToUpdate.phoneNumber || details.mobileNumber,
        loginMethod: userToUpdate.providerData[0]?.providerId || 'unknown',
        sourceGuestId: guestIdBeforeAuth,
      }, userToUpdate.uid, null);

      clearGuestId();
      await syncCartOnLogin(userToUpdate.uid);

      if (appConfig.smtpHost && details.email) {
        sendWelcomeEmail({
          userName: details.fullName,
          userEmail: details.email,
          smtpHost: appConfig.smtpHost, smtpPort: appConfig.smtpPort,
          smtpUser: appConfig.smtpUser, smtpPass: appConfig.smtpPass, senderEmail: appConfig.senderEmail,
        }).catch((err: any) => console.error("Failed to send welcome email:", err));
      }

      setUser(userToUpdate);
      setIsCompletingProfile(false);
      setPendingUserForProfileCompletion(null);

      toast({ title: "Account Created!", description: "Welcome to Screenplay Pro!" });

      const redirectPathFromQuery = searchParams.get('redirect');
      let finalRedirectPath = '/';
      if (userToUpdate.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
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
  }, [pendingUserForProfileCompletion, saveMySQLUser, toast, router, searchParams, authActionRedirectPath, appConfig]);

  const checkUsernameAvailability = useCallback(async (_username: string, _excludeUid?: string): Promise<boolean> => {
    return true;
  }, []);

  const generateUsernameSuggestions = useCallback(async (_baseName: string): Promise<string[]> => {
    return [];
  }, []);

  const signUp = useCallback(async (data: SignUpData) => {
    if (!data.password) {
      toast({ title: "Error", description: "Password is required.", variant: "destructive" });
      throw new Error("Password is required");
    }
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const { user } = userCredential;

      if (data.fullName) {
        await updateProfile(user, { displayName: data.fullName });
      }

      const formattedMobile = data.mobileNumber
        ? (data.mobileNumber.startsWith('+') ? data.mobileNumber : `${appConfig.defaultOtpCountryCode || '+91'}${data.mobileNumber.replace(/\D/g, '')}`)
        : '';

      const newUserData = {
        id: user.uid,
        email: data.email,
        displayName: data.fullName || 'User',
        mobileNumber: formattedMobile,
        photoURL: user.photoURL || '',
        isActive: 1,
        roles: ['user']
      };

      await saveMySQLUser(newUserData);
      setFirestoreUser(newUserData as unknown as FirestoreUser);

      await handleSuccessfulAuth(userCredential);
    } catch (error) {
      const authError = error as AuthError;
      console.error("Signup error:", authError);
      toast({ title: "Signup Failed", description: authError.message, variant: "destructive" });
      setIsLoading(false);
      throw authError;
    }
  }, [toast, handleSuccessfulAuth, saveMySQLUser, appConfig]);

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
      setFirestoreUser(null);
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
