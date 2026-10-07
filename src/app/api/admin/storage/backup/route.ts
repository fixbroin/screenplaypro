import { NextResponse } from 'next/server';
import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const zip = new AdmZip();
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');

    if (fs.existsSync(uploadsDir)) {
      zip.addLocalFolder(uploadsDir, 'uploads');
    }

    const buffer = zip.toBuffer();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `media-storage-backup-${timestamp}.zip`;

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error("Error creating storage backup zip:", error);
    return NextResponse.json({ success: false, error: error.message || 'Storage backup failed' }, { status: 500 });
  }
}
