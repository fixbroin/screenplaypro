import { NextResponse } from 'next/server';
import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import { exportAllDatabaseTables } from '@/lib/backupUtils';

export async function GET() {
  try {
    const zip = new AdmZip();

    // 1. Dump full MySQL database into JSON
    const databaseData = await exportAllDatabaseTables();
    const databaseJson = JSON.stringify(databaseData, null, 2);
    zip.addFile('database-backup.json', Buffer.from(databaseJson, 'utf-8'));

    // 2. Package all uploaded images from public/uploads
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (fs.existsSync(uploadsDir)) {
      zip.addLocalFolder(uploadsDir, 'uploads');
    }

    // 3. Package banners if exists
    const bannerDir = path.join(process.cwd(), 'public', 'banner');
    if (fs.existsSync(bannerDir)) {
      zip.addLocalFolder(bannerDir, 'banner');
    }

    // 4. Create README with backup info
    const readmeContent = `Screenplay Pro - Full System Backup
Exported At: ${new Date().toISOString()}
Database Records: ${Object.entries(databaseData.summary).map(([k, v]) => `${k}: ${v}`).join(', ')}
Media Storage: Includes all files inside public/uploads (ads, slideshows, web-settings, branding, etc.)
`;
    zip.addFile('BACKUP_INFO.txt', Buffer.from(readmeContent, 'utf-8'));

    const buffer = zip.toBuffer();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `full-system-complete-backup-${timestamp}.zip`;

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Error generating complete system backup:', error);
    return NextResponse.json({ success: false, error: error.message || 'System backup failed' }, { status: 500 });
  }
}
