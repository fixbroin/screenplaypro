
"use client";

import { useState, useEffect } from 'react';

export interface AdminStats {
  completedRevenue: number;
  totalBookings: number;
  activeUsers: number;
  newSignups30d: number;
  earnedCommission: number;
  updatedAt?: any;
}

export function useAdminStats() {
  const [stats, setStats] = useState<AdminStats>({
    completedRevenue: 0,
    totalBookings: 0,
    activeUsers: 0,
    newSignups30d: 0,
    earnedCommission: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/db/users').then(r => r.json()).catch(() => null),
      fetch('/api/db/scripts').then(r => r.json()).catch(() => null),
      fetch('/api/db/subscribers').then(r => r.json()).catch(() => null)
    ]).then(([usersRes, scriptsRes, subRes]) => {
      const activeUsers = usersRes?.success && Array.isArray(usersRes.users) ? usersRes.users.length : 0;
      const totalBookings = scriptsRes?.success && Array.isArray(scriptsRes.scripts) ? scriptsRes.scripts.length : 0;
      const subscribers = subRes?.success && Array.isArray(subRes.subscribers) ? subRes.subscribers : [];
      const completedRevenue = subscribers.reduce((acc: number, item: any) => acc + (Number(item.amount) || 0), 0);

      setStats({
        completedRevenue,
        totalBookings,
        activeUsers,
        newSignups30d: activeUsers,
        earnedCommission: completedRevenue * 0.1,
      });
      setIsLoading(false);
    }).catch(err => {
      console.error("Error fetching admin stats from MySQL:", err);
      setIsLoading(false);
    });
  }, []);

  return { stats, isLoading, error };
}
