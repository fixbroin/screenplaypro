// src/lib/revalidateUtils.ts
'use server';

import { revalidateTag } from 'next/cache';
import { adminDb } from './firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { submitToGoogleIndexing } from './googleIndexing';

/**
 * Smart Trigger: Tells the server to clear the cache for specific data
 * so that the next request pulls fresh data from Firestore.
 * Also increments the global cache version in Firestore to signal clients.
 */
export async function triggerRefresh(tag: 'services' | 'categories' | 'cities' | 'bookings' | 'users' | 'content' | 'blog' | 'global' | 'withdrawal-referral-config' | 'withdrawal-Artist-config' | string) {
  try {
    revalidateTag(tag);
    
    // Bump the global cache version (1 write)
    // Only bump "global" if the change is truly global (settings/SEO)
    // This prevents every user login/booking from forcing all visitors to re-read settings.
    const isGlobalChange = ['global', 'app-settings', 'web-settings', 'seo-settings', 'marketing-settings', 'global-cache'].includes(tag);
    
    const versionDoc = adminDb.collection('appConfiguration').doc('cacheVersions');
    const updates: any = {
        [tag]: FieldValue.increment(1),
        updatedAt: new Date()
    };
    
    if (isGlobalChange) {
        updates.global = FieldValue.increment(1);
    }
    
    await versionDoc.set(updates, { merge: true });

    console.log(`[SmartSync] Cache invalidated for tag: ${tag} and version bumped (Global: ${isGlobalChange}).`);
    return { success: true };
  } catch (error) {
    console.error(`[SmartSync] Failed to invalidate tag: ${tag}`, error);
    return { success: false };
  }
}

export async function submitProfileToGoogleIndexing(categorySlug: string, username: string, type: 'URL_UPDATED' | 'URL_DELETED' = 'URL_UPDATED') {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://screenplaypro.in';
    const profileUrl = `${baseUrl}/category/${categorySlug}/${username}`;
    return await submitToGoogleIndexing(profileUrl, type);
  } catch (error: any) {
    console.error(`[Google Indexing Server Action] Failed for ${username}:`, error);
    return { success: false, error: error.message };
  }
}

export async function submitPathToGoogleIndexing(path: string, type: 'URL_UPDATED' | 'URL_DELETED' = 'URL_UPDATED') {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://screenplaypro.in';
    const fullUrl = `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    return await submitToGoogleIndexing(fullUrl, type);
  } catch (error: any) {
    console.error(`[Google Indexing Server Action] Failed for path ${path}:`, error);
    return { success: false, error: error.message };
  }
}

