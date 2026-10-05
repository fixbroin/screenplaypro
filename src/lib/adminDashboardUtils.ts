// src/lib/adminDashboardUtils.ts
'use server';

import { queryDb } from './mysql';
import { unstable_cache } from 'next/cache';

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
      const [users, scripts, subs] = await Promise.all([
        queryDb<any[]>("SELECT id, email, displayName, isActive, subscriptionActive, createdAt FROM users").catch(() => []),
        queryDb<any[]>("SELECT id FROM scripts").catch(() => []),
        queryDb<any[]>("SELECT amount FROM userSubscriptions").catch(() => [])
      ]);

      let totalRevenue = 0;
      subs.forEach(s => {
        totalRevenue += (Number(s.amount) || 0);
      });

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let activeUsers = 0;
      let newSignups = 0;
      let activeSubscriptions = 0;

      users.forEach(u => {
        if (u.isActive !== 0) activeUsers++;
        if (u.subscriptionActive) activeSubscriptions++;
        if (u.createdAt && new Date(u.createdAt) >= thirtyDaysAgo) {
          newSignups++;
        }
      });

      const activeScripts = scripts.length || 0;
      const topSearchTerms: { term: string; count: number }[] = [];

      const recentUsers = users
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 7);

      const activities = recentUsers.map(u => ({
        id: u.id,
        type: 'new_user_signup',
        timestamp: u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString(),
        title: 'New User Signup',
        description: `${u.displayName || u.email || 'Anonymous User'} registered`,
        href: `/admin/users`,
      }));

      return {
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
      };
    } catch (error) {
      console.error("Error in getDashboardData:", error);
      return {
        stats: { totalRevenue: 0, activeScripts: 0, activeUsers: 0, newSignups: 0, activeSubscriptions: 0 },
        analytics: { topSearchTerms: [] },
        recentActivities: []
      };
    }
  },
  ['admin-dashboard-stats'],
  { revalidate: 3600, tags: ['admin-stats', 'global-cache'] }
);

export const getArchivedBookings = async () => [];
export const getArchivedUsers = async () => [];
export const getArchivedActivities = async () => [];
export async function clearSearchHotspots() { return { success: true }; }
