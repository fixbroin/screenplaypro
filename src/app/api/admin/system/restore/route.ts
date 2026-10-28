import { NextRequest, NextResponse } from 'next/server';
import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import { restoreAllDatabaseTables } from '@/lib/backupUtils';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No ZIP backup file provided.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();

    let databaseJson: any = null;
    let restoredImagesCount = 0;

    const publicUploadsDir = path.join(process.cwd(), 'public', 'uploads');
    const publicBannerDir = path.join(process.cwd(), 'public', 'banner');

    if (!fs.existsSync(publicUploadsDir)) {
      fs.mkdirSync(publicUploadsDir, { recursive: true });
    }

    // 1. Unpack files and find database-backup.json
    for (const entry of entries) {
      if (entry.isDirectory) continue;

      const normName = entry.entryName.replace(/\\/g, '/');

      // Check if it's the database JSON backup
      if (normName === 'database-backup.json' || normName.endsWith('/database-backup.json') || (normName.endsWith('.json') && !normName.includes('/'))) {
        try {
          const content = entry.getData().toString('utf-8');
          databaseJson = JSON.parse(content);
        } catch (jsonErr) {
          console.error("Could not parse database-backup.json inside ZIP:", jsonErr);
        }
        continue;
      }

      // Check if it's info or readme
      if (normName.endsWith('.txt')) continue;

      // Restore uploads media
      if (normName.startsWith('uploads/')) {
        const relativePath = normName.replace(/^uploads\//, '');
        const targetPath = path.join(publicUploadsDir, relativePath);
        const targetDir = path.dirname(targetPath);

        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        fs.writeFileSync(targetPath, entry.getData());
        restoredImagesCount++;
      } else if (normName.startsWith('banner/')) {
        const relativePath = normName.replace(/^banner\//, '');
        const targetPath = path.join(publicBannerDir, relativePath);
        const targetDir = path.dirname(targetPath);

        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        fs.writeFileSync(targetPath, entry.getData());
        restoredImagesCount++;
      }
    }

    // 2. Restore database records if database JSON was found in the ZIP
    let dbRestoreResult: any = null;
    if (databaseJson) {
      dbRestoreResult = await restoreAllDatabaseTables(databaseJson);
    }

    return NextResponse.json({
      success: true,
      message: `System restore completed! Restored ${restoredImagesCount} media files${dbRestoreResult ? ` and ${dbRestoreResult.totalRestored} database records across tables` : ''}.`,
      restoredImagesCount,
      database: dbRestoreResult
    });
  } catch (error: any) {
    console.error("Error during full system restore:", error);
    return NextResponse.json({ success: false, error: error.message || 'System restore failed.' }, { status: 500 });
  }
}
