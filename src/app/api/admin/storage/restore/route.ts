import { NextRequest, NextResponse } from 'next/server';
import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';

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

    const publicUploadsDir = path.join(process.cwd(), 'public', 'uploads');
    const publicBannerDir = path.join(process.cwd(), 'public', 'banner');
    if (!fs.existsSync(publicUploadsDir)) {
      fs.mkdirSync(publicUploadsDir, { recursive: true });
    }

    let restoredCount = 0;

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      let relativePath = entry.entryName.replace(/\\/g, '/');
      let targetPath = '';

      if (relativePath.startsWith('banner/')) {
        const sub = relativePath.replace(/^banner\//, '');
        targetPath = path.join(publicBannerDir, sub);
      } else {
        if (relativePath.startsWith('uploads/')) {
          relativePath = relativePath.replace(/^uploads\//, '');
        }
        targetPath = path.join(publicUploadsDir, relativePath);
      }

      const targetDir = path.dirname(targetPath);

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      fs.writeFileSync(targetPath, entry.getData());
      restoredCount++;
    }

    return NextResponse.json({
      success: true,
      message: `Successfully restored ${restoredCount} media file(s) into local storage folders.`,
      restoredCount
    });
  } catch (error: any) {
    console.error("Error restoring storage backup:", error);
    return NextResponse.json({ success: false, error: error.message || 'Storage restore failed.' }, { status: 500 });
  }
}
