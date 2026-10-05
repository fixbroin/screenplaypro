"use client";

import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

interface UseUnreadNotificationsCountReturn {
  count: number;
  isLoading: boolean;
}

export function useUnreadNotificationsCount(userIdOverride?: string): UseUnreadNotificationsCountReturn {
  const { user, isLoading: authLoading } = useAuth();
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const effectiveUserId = userIdOverride || user?.uid;

  useEffect(() => {
    if (authLoading) {
      setIsLoading(true);
      return;
    }

    if (!effectiveUserId) {
      setCount(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetch('/api/db/collections?name=userNotifications')
      .then(res => res.json())
      .then(json => {
        if (json.success && Array.isArray(json.data)) {
          const unread = json.data.filter((item: any) => item.userId === effectiveUserId && !item.read);
          setCount(unread.length);
        } else {
          setCount(0);
        }
      })
      .catch((err) => {
        console.error("Error fetching unread notifications count from MySQL:", err);
        setCount(0);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [authLoading, effectiveUserId]);

  return { count, isLoading };
}
