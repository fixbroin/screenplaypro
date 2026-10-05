import type { FirestoreUser } from '@/types/firestore';
import { ADMIN_EMAIL } from '@/lib/constants';

export interface SubscriptionStatusResult {
  isActive: boolean;
  isExpired: boolean;
  expiresDate: Date | null;
  daysRemaining: number;
  statusText: string;
}

/**
 * Checks whether a given user has an active Screenplay Pro subscription.
 */
export function checkSubscriptionStatus(
  firestoreUser: FirestoreUser | null | undefined,
  userEmail?: string | null
): SubscriptionStatusResult {
  // 1. Admin bypass: Admins always have full access
  const email = userEmail || firestoreUser?.email;
  if (email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    return {
      isActive: true,
      isExpired: false,
      expiresDate: null,
      daysRemaining: 99999,
      statusText: "Admin Access (Unlimited)"
    };
  }

  if (firestoreUser?.roles?.includes('admin')) {
    return {
      isActive: true,
      isExpired: false,
      expiresDate: null,
      daysRemaining: 99999,
      statusText: "Admin Access (Unlimited)"
    };
  }

  if (!firestoreUser) {
    return {
      isActive: false,
      isExpired: false,
      expiresDate: null,
      daysRemaining: 0,
      statusText: "Not Logged In"
    };
  }

  const isSubscribed = !!firestoreUser.subscriptionActive;
  let expiresDate: Date | null = null;
  let daysRemaining = 0;

  if (firestoreUser.subscriptionExpiresAt) {
    const expiresMillis = typeof firestoreUser.subscriptionExpiresAt.toMillis === 'function'
      ? firestoreUser.subscriptionExpiresAt.toMillis()
      : (firestoreUser.subscriptionExpiresAt as any)?.seconds
        ? (firestoreUser.subscriptionExpiresAt as any).seconds * 1000
        : (firestoreUser.subscriptionExpiresAt as any);

    if (expiresMillis) {
      expiresDate = new Date(expiresMillis);
      const diffMs = expiresDate.getTime() - Date.now();
      daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }
  }

  // An active subscription must be flagged active AND not passed expiration timestamp if set
  const isExpired = isSubscribed && expiresDate !== null && Date.now() > expiresDate.getTime();
  const isActive = isSubscribed && !isExpired;

  let statusText = "No Subscription";
  if (isActive) {
    statusText = expiresDate ? `Active (Expires in ${daysRemaining} days)` : "Active";
  } else if (isExpired) {
    statusText = `Expired on ${expiresDate ? expiresDate.toLocaleDateString() : 'recently'}`;
  }

  return {
    isActive,
    isExpired,
    expiresDate,
    daysRemaining: Math.max(0, daysRemaining),
    statusText
  };
}
