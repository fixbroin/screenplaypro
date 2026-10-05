// src/lib/adminDashboardUtils.ts
'use server';

import { adminDb } from './firebaseAdmin';
import { unstable_cache, revalidateTag } from 'next/cache';
import { Timestamp } from 'firebase-admin/firestore';
import type { FirestoreBooking, FirestoreUser, FirestoreService, UserActivity } from '@/types/firestore';
import { serializeFirestoreData } from './serializeUtils';

export interface DashboardData {
  stats: {
    totalRevenue: number;
    activeScripts: number;
    activeUsers: number;
    newSignups: number;
    activeSubscriptions: number;
  };
  analytics: {
    topSearchTerms: { term: string; count: number }[];
  };
  recentActivities: any[];
}

export const getDashboardData = unstable_cache(
  async (ArtistFeeType?: string, ArtistFeeValue?: number): Promise<DashboardData> => {
    try {
      // 1. Fetch Aggregate Stats & Queries
      const [usersSnap, scriptsSnap, subsSnap, searchActivitiesSnap, persistentSearchSnap] = await Promise.all([
        adminDb.collection('users').get(),
        adminDb.collection('scripts').get().catch(() => ({ size: 0, docs: [] })),
        adminDb.collection('userSubscriptions').get().catch(() => ({ size: 0, docs: [] })),
        adminDb.collection('userActivities').where('eventType', '==', 'search').limit(100).get().catch(() => ({ docs: [] })),
        adminDb.collection('searchAnalytics').limit(100).get().catch(() => ({ docs: [] }))
      ]);

      let totalRevenue = 0;
      subsSnap.docs?.forEach(doc => {
        const data = doc.data ? doc.data() : {};
        totalRevenue += (data.amount || 0);
      });

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let activeUsers = 0;
      let newSignups = 0;
      let activeSubscriptions = 0;

      usersSnap.forEach(doc => {
        const data = doc.data() as FirestoreUser;
        if (data.isActive !== false) activeUsers++;
        if (data.subscriptionActive) activeSubscriptions++;
        if (data.createdAt && data.createdAt.toDate && data.createdAt.toDate() >= thirtyDaysAgo) {
          newSignups++;
        }
      });

      const activeScripts = scriptsSnap.size || 0;

      // 2. Analytics: Search Hotspots
      const searchCounts: { [key: string]: number } = {};
      searchActivitiesSnap.docs?.forEach(doc => {
        const term = doc.data().eventData?.searchQuery?.toLowerCase().trim();
        if (term) searchCounts[term] = (searchCounts[term] || 0) + 1;
      });
      persistentSearchSnap.docs?.forEach(doc => {
        const term = doc.data().term?.toLowerCase().trim();
        if (term) searchCounts[term] = (searchCounts[term] || 0) + 1;
      });
      const topSearchTerms = Object.entries(searchCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([term, count]) => ({ term, count }))
        .slice(0, 20);

      // 3. Recent Activities
      const recentUsers = await adminDb.collection('users').orderBy('createdAt', 'desc').limit(7).get().catch(() => ({ docs: [] }));

      const activities = recentUsers.docs.map(doc => {
        const data = doc.data() as FirestoreUser;
        return {
          id: doc.id,
          type: 'new_user_signup',
          timestamp: serializeFirestoreData<string>(data.createdAt || new Date().toISOString()),
          title: 'New User Signup',
          description: `${data.displayName || data.email || 'Anonymous User'} registered`,
          href: `/admin/users`,
        };
      }).sort((a, b) => new Date(b.timestamp as string).getTime() - new Date(a.timestamp as string).getTime()).slice(0, 7);

      return serializeFirestoreData<DashboardData>({
        stats: {
          totalRevenue,
          activeScripts,
          activeUsers,
          newSignups,
          activeSubscriptions
        },
        analytics: {
          topSearchTerms
        },
        recentActivities: activities
      });
    } catch (error) {
      console.error("Error in getDashboardData:", error);
      throw error;
    }
  },
  ['admin-dashboard-stats'],
  { revalidate: 3600, tags: ['admin-stats', 'global-cache'] }
);

export const getArchivedBookings = unstable_cache(
  async (): Promise<FirestoreBooking[]> => {
    try {
      const q = adminDb.collection('bookings').orderBy('createdAt', 'desc');
      
      const offset = 10;
      const snapshot = await q.offset(offset).limit(50).get();
      
      return serializeFirestoreData(snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as FirestoreBooking)));
    } catch (error) {
      console.error("Error in getArchivedBookings:", error);
      return [];
    }
  },
  ['archived-bookings', 'bookings'],
  { revalidate: 31536000, tags: ['bookings', 'global-cache'] } // Lifetime cache
);

export const getArchivedUsers = unstable_cache(
  async (): Promise<FirestoreUser[]> => {
    try {
      const q = adminDb.collection('users').orderBy('createdAt', 'desc');
      
      const offset = 20;
      const snapshot = await q.offset(offset).limit(50).get();
      
      return serializeFirestoreData(snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as FirestoreUser)));
    } catch (error) {
      console.error("Error in getArchivedUsers:", error);
      return [];
    }
  },
  ['archived-users', 'users'],
  { revalidate: 31536000, tags: ['users', 'global-cache'] }
);

export const getArchivedActivities = unstable_cache(
  async (): Promise<UserActivity[]> => {
    try {
      const snapshot = await adminDb.collection('userActivities')
        .orderBy('timestamp', 'desc')
        .limit(100)
        .get();

      return serializeFirestoreData(snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as UserActivity)));
    } catch (error) {
      console.error("Error in getArchivedActivities:", error);
      return [];
    }
  },
  ['archived-activities'],
  { revalidate: 31536000, tags: ['activities', 'global-cache'] }
);

export async function clearSearchHotspots() {
  try {
    const batchSize = 500;
    
    // 1. Delete from searchAnalytics
    const searchAnalyticsSnap = await adminDb.collection('searchAnalytics').limit(batchSize).get();
    if (!searchAnalyticsSnap.empty) {
      const batch = adminDb.batch();
      searchAnalyticsSnap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    // 2. Delete from userActivities where eventType is 'search'
    const searchActivitiesSnap = await adminDb.collection('userActivities')
      .where('eventType', '==', 'search')
      .limit(batchSize)
      .get();
      
    if (!searchActivitiesSnap.empty) {
      const batch = adminDb.batch();
      searchActivitiesSnap.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    revalidateTag('admin-dashboard-stats');
    return { success: true };
  } catch (error) {
    console.error("Error clearing search hotspots:", error);
    return { success: false, error: String(error) };
  }
}

