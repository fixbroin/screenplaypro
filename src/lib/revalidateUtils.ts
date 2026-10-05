// src/lib/revalidateUtils.ts
'use server';

import { revalidateTag } from 'next/cache';
import { queryDb } from './mysql';
import { submitToGoogleIndexing } from './googleIndexing';

/**
 * Smart Trigger: Tells the server to clear the cache for specific data
 * so that the next request pulls fresh data from MySQL.
 */
export async function triggerRefresh(tag: string) {
  try {
    revalidateTag(tag);
    
    const isGlobalChange = ['global', 'app-settings', 'web-settings', 'seo-settings', 'marketing-settings', 'global-cache'].includes(tag);
    
    const updates = { tag, isGlobalChange, updatedAt: new Date().toISOString() };
    await queryDb(
      `INSERT INTO generic_collections (id, collection_name, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data = ?`,
      ['cacheVersions', 'appConfiguration', JSON.stringify(updates), JSON.stringify(updates)]
    ).catch(() => {});

    console.log(`[SmartSync] Cache invalidated for tag: ${tag} (Global: ${isGlobalChange}).`);
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
