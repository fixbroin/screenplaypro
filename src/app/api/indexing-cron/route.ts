import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { initFirebaseAdmin } from '@/lib/firebase-admin';
import { getSitemapEntries } from '@/app/sitemap';
import { submitToGoogleIndexing } from '@/lib/googleIndexing';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const secret = new URL(req.url).searchParams.get('secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    initFirebaseAdmin();
    console.log("[Google Indexing Cron] Job started at:", new Date().toISOString());

    // 1. Fetch settings from Firestore
    const settingsDoc = await adminDb.collection('appConfiguration').doc('googleIndexingSettings').get();
    if (!settingsDoc.exists || !settingsDoc.data()?.isCronActive) {
      console.log("[Google Indexing Cron] Bulk cron is inactive or disabled. Aborting.");
      return NextResponse.json({ success: true, message: "Bulk cron is disabled in settings. Aborted." });
    }

    // 2. Fetch sitemap URLs
    const sitemapEntries = await getSitemapEntries();
    const sitemapUrls = sitemapEntries.map(entry => entry.url);
    const totalSiteUrls = sitemapUrls.length;

    // 3. Fetch successfully submitted logs
    const logsSnapshot = await adminDb.collection('googleIndexingLogs')
      .where('status', '==', 'success')
      .get();

    const indexedUrls = new Set<string>();
    logsSnapshot.forEach(doc => {
      indexedUrls.add(doc.data().url);
    });

    // 4. Filter pending URLs
    const pendingUrls = sitemapUrls.filter(url => !indexedUrls.has(url));
    console.log(`[Google Indexing Cron] Total sitemap URLs: ${totalSiteUrls}, Indexed: ${indexedUrls.size}, Pending: ${pendingUrls.length}`);

    if (pendingUrls.length === 0) {
      // Balance pending is 0, turn off cron switch in settings
      await adminDb.collection('appConfiguration').doc('googleIndexingSettings').set({
        isCronActive: false,
        updatedAt: Timestamp.now(),
      }, { merge: true });
      
      console.log("[Google Indexing Cron] No pending URLs left. Cron switch disabled automatically.");
      return NextResponse.json({ success: true, message: "No pending URLs left. Cron disabled automatically." });
    }

    // Daily limit of Google Indexing API is 200 requests. Process at most 180 to leave safety buffer.
    const batchSize = Math.min(pendingUrls.length, 180);
    const urlsToSubmit = pendingUrls.slice(0, batchSize);

    console.log(`[Google Indexing Cron] Running batch submission for ${batchSize} URLs...`);

    // Submit in chunks of 10 in parallel
    let successCount = 0;
    const chunkSize = 10;
    for (let i = 0; i < urlsToSubmit.length; i += chunkSize) {
      const chunk = urlsToSubmit.slice(i, i + chunkSize);
      const results = await Promise.all(
        chunk.map(url => submitToGoogleIndexing(url, 'URL_UPDATED'))
      );
      successCount += results.filter(res => res.success).length;
    }

    const remainingCount = pendingUrls.length - batchSize;
    console.log(`[Google Indexing Cron] Batch finished. Successfully processed ${successCount} / ${batchSize}. Remaining: ${remainingCount}`);

    // If no remaining URLs left after this run, automatically disable the cron switch
    if (remainingCount === 0) {
      await adminDb.collection('appConfiguration').doc('googleIndexingSettings').set({
        isCronActive: false,
        updatedAt: Timestamp.now(),
      }, { merge: true });
      console.log("[Google Indexing Cron] All pending URLs successfully processed. Cron disabled automatically.");
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${successCount} out of ${batchSize} URLs successfully.`,
      submitted: successCount,
      remaining: remainingCount
    });

  } catch (error: any) {
    console.error("[Google Indexing Cron] Fatal error during execution:", error);
    return NextResponse.json({ success: false, error: error.message || "Execution failed." }, { status: 500 });
  }
}
