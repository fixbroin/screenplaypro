import { type NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/mysql';
import { getSitemapEntries } from '@/app/sitemap';
import { submitToGoogleIndexing } from '@/lib/googleIndexing';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const secret = new URL(req.url).searchParams.get('secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log("[Google Indexing Cron] Job started at:", new Date().toISOString());

    const settingsRows = await queryDb<any[]>(
      "SELECT data FROM generic_collections WHERE collection_name = 'appConfiguration' AND id = 'googleIndexingSettings'"
    ).catch(() => []);

    let isCronActive = false;
    if (settingsRows.length > 0) {
      try {
        const data = JSON.parse(settingsRows[0].data);
        isCronActive = !!data?.isCronActive;
      } catch (e) {}
    }

    if (!isCronActive) {
      console.log("[Google Indexing Cron] Bulk cron is inactive or disabled. Aborting.");
      return NextResponse.json({ success: true, message: "Bulk cron is disabled in settings. Aborted." });
    }

    const sitemapEntries = await getSitemapEntries();
    const sitemapUrls = sitemapEntries.map(entry => entry.url);
    const totalSiteUrls = sitemapUrls.length;

    const logsRows = await queryDb<any[]>(
      "SELECT data FROM generic_collections WHERE collection_name = 'googleIndexingLogs'"
    ).catch(() => []);

    const indexedUrls = new Set<string>();
    logsRows.forEach(row => {
      try {
        const data = JSON.parse(row.data);
        if (data.status === 'success' && data.url) {
          indexedUrls.add(data.url);
        }
      } catch (e) {}
    });

    const pendingUrls = sitemapUrls.filter(url => !indexedUrls.has(url));
    console.log(`[Google Indexing Cron] Total sitemap URLs: ${totalSiteUrls}, Indexed: ${indexedUrls.size}, Pending: ${pendingUrls.length}`);

    if (pendingUrls.length === 0) {
      const updates = { isCronActive: false, updatedAt: new Date().toISOString() };
      await queryDb(
        `INSERT INTO generic_collections (id, collection_name, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data = ?`,
        ['googleIndexingSettings', 'appConfiguration', JSON.stringify(updates), JSON.stringify(updates)]
      ).catch(() => {});
      
      console.log("[Google Indexing Cron] No pending URLs left. Cron switch disabled automatically.");
      return NextResponse.json({ success: true, message: "No pending URLs left. Cron disabled automatically." });
    }

    const batchSize = Math.min(pendingUrls.length, 180);
    const urlsToSubmit = pendingUrls.slice(0, batchSize);

    console.log(`[Google Indexing Cron] Running batch submission for ${batchSize} URLs...`);

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

    if (remainingCount === 0) {
      const updates = { isCronActive: false, updatedAt: new Date().toISOString() };
      await queryDb(
        `INSERT INTO generic_collections (id, collection_name, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data = ?`,
        ['googleIndexingSettings', 'appConfiguration', JSON.stringify(updates), JSON.stringify(updates)]
      ).catch(() => {});
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
