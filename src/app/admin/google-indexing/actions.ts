'use server';

import { getSitemapEntries } from '@/app/sitemap';
import { adminDb } from '@/lib/firebaseAdmin';
import { submitToGoogleIndexing } from '@/lib/googleIndexing';
import { Timestamp } from 'firebase-admin/firestore';
import { triggerRefresh } from '@/lib/revalidateUtils';

export interface IndexingStats {
  totalSiteUrls: number;
  submittedCount: number;
  balancePending: number;
  isCronActive: boolean;
  recentSubmissions: {
    id: string;
    url: string;
    type: string;
    status: 'success' | 'failure';
    error?: string | null;
    processedDate: string;
  }[];
}

export async function getIndexingStats(): Promise<IndexingStats> {
  try {
    // 1. Fetch all unique sitemap URLs
    const sitemapEntries = await getSitemapEntries();
    const sitemapUrls = sitemapEntries.map(entry => entry.url);
    const totalSiteUrls = sitemapUrls.length;

    // 2. Fetch all successful logs from googleIndexingLogs
    const logsSnapshot = await adminDb.collection('googleIndexingLogs')
      .where('status', '==', 'success')
      .get();

    const indexedUrls = new Set<string>();
    logsSnapshot.forEach(doc => {
      indexedUrls.add(doc.data().url);
    });

    // Calculate count of compiled sitemap URLs that are successfully indexed
    const submittedCount = sitemapUrls.filter(url => indexedUrls.has(url)).length;
    const balancePending = Math.max(0, totalSiteUrls - submittedCount);

    // 3. Fetch cron setting from appConfiguration/googleIndexingSettings
    const settingsDoc = await adminDb.collection('appConfiguration').doc('googleIndexingSettings').get();
    const isCronActive = settingsDoc.exists ? !!settingsDoc.data()?.isCronActive : false;

    // 4. Fetch the last 20 submissions
    const recentSnapshot = await adminDb.collection('googleIndexingLogs')
      .orderBy('processedDate', 'desc')
      .limit(20)
      .get();

    const recentSubmissions = recentSnapshot.docs.map(doc => {
      const data = doc.data();
      let dateString = 'N/A';
      if (data.processedDate) {
        const date = (data.processedDate as Timestamp).toDate();
        dateString = date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      }
      return {
        id: doc.id,
        url: data.url || 'N/A',
        type: data.type || 'URL_UPDATED',
        status: data.status || 'failure',
        error: data.error || null,
        processedDate: dateString,
      };
    });

    return {
      totalSiteUrls,
      submittedCount,
      balancePending,
      isCronActive,
      recentSubmissions,
    };
  } catch (error: any) {
    console.error("Failed to fetch Google Indexing stats:", error);
    return {
      totalSiteUrls: 0,
      submittedCount: 0,
      balancePending: 0,
      isCronActive: false,
      recentSubmissions: [],
    };
  }
}

export async function toggleCronActive(isActive: boolean): Promise<{ success: boolean; message: string }> {
  try {
    await adminDb.collection('appConfiguration').doc('googleIndexingSettings').set({
      isCronActive: isActive,
      updatedAt: Timestamp.now(),
    }, { merge: true });

    await triggerRefresh('global-cache');
    return { success: true, message: `VPS Cron ${isActive ? 'Enabled' : 'Disabled'} successfully.` };
  } catch (error: any) {
    console.error("Failed to toggle indexing cron setting:", error);
    return { success: false, message: error.message || "Failed to update settings." };
  }
}

export async function runManualBatch(): Promise<{ success: boolean; message: string; submittedCount: number }> {
  try {
    // 1. Fetch sitemap URLs
    const sitemapEntries = await getSitemapEntries();
    const sitemapUrls = sitemapEntries.map(entry => entry.url);

    // 2. Fetch existing indexed URLs
    const logsSnapshot = await adminDb.collection('googleIndexingLogs')
      .where('status', '==', 'success')
      .get();

    const indexedUrls = new Set<string>();
    logsSnapshot.forEach(doc => {
      indexedUrls.add(doc.data().url);
    });

    // 3. Find pending URLs
    const pendingUrls = sitemapUrls.filter(url => !indexedUrls.has(url));
    if (pendingUrls.length === 0) {
      return { success: true, message: "No pending URLs found to submit.", submittedCount: 0 };
    }

    // Daily limit of Google Indexing API is 200 requests. Let's submit at most 180 to leave buffer.
    const batchSize = Math.min(pendingUrls.length, 180);
    const urlsToSubmit = pendingUrls.slice(0, batchSize);

    console.log(`[Google Indexing] Running manual batch for ${batchSize} URLs...`);

    // Submit in parallel but controlled chunk batches to avoid spamming the fetch connection
    let successCount = 0;
    const chunkSize = 10;
    for (let i = 0; i < urlsToSubmit.length; i += chunkSize) {
      const chunk = urlsToSubmit.slice(i, i + chunkSize);
      const results = await Promise.all(
        chunk.map(url => submitToGoogleIndexing(url, 'URL_UPDATED'))
      );
      successCount += results.filter(res => res.success).length;
    }

    return {
      success: true,
      message: `Successfully processed manual batch. Submitted ${successCount} out of ${batchSize} URLs.`,
      submittedCount: successCount,
    };
  } catch (error: any) {
    console.error("Failed during manual indexing batch submission:", error);
    return { success: false, message: error.message || "Batch submission failed.", submittedCount: 0 };
  }
}
