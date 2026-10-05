import type { UserActivityEventType, UserActivityEventData } from '@/types/firestore';
import { triggerRefresh } from './revalidateUtils';

const removeUndefinedProps = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedProps);
  } else if (obj !== null && typeof obj === 'object') {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = removeUndefinedProps(value);
      }
      return acc;
    }, {} as Record<string, any>);
  }
  return obj;
};

const isBot = (): boolean => {
    if (typeof window === 'undefined') return true;
    const botPatterns = [
        'bot', 'crawler', 'spider', 'crawling', 'googlebot', 'bingbot', 'yandexbot', 
        'slurp', 'duckduckbot', 'baiduspider', 'adsbot', 'mediapartners-google',
        'lighthouse', 'gtmetrix', 'pingdom', 'facebookexternalhit', 'whatsapp', 'linkedinbot'
    ];
    const ua = navigator.userAgent.toLowerCase();
    return botPatterns.some(pattern => ua.includes(pattern));
};

export const logUserActivity = async (
  eventType: UserActivityEventType,
  eventData: UserActivityEventData,
  userId?: string | null,
  guestId?: string | null,
  userDisplayName?: string | null
): Promise<void> => {
  if (!userId && !guestId) return;
  if (isBot()) return;

  try {
    const finalDisplayName = userDisplayName || eventData.fullName || (userId ? "Registered User" : "Guest User");
    const docId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const activityData = {
      id: docId,
      userId: userId || null,
      guestId: guestId || null,
      userDisplayName: finalDisplayName,
      eventType,
      eventData: removeUndefinedProps(eventData),
      timestamp: new Date().toISOString(),
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'server',
    };

    await fetch('/api/db/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collectionName: 'userActivities', id: docId, data: activityData })
    });

    if (['newBooking', 'newUser', 'userLogin'].includes(eventType)) {
      await triggerRefresh('users');
    }
  } catch (error) {
    console.error('Error logging user activity to MySQL:', error);
  }
};
