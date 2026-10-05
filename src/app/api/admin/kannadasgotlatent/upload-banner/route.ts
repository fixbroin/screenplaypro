import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

async function checkAdminAuth(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }
  const token = authHeader.split('Bearer ')[1];
  return await adminAuth.verifyIdToken(token);
}

export async function POST(req: NextRequest) {
  try {
    // 1) Verify Admin authorization
    await checkAdminAuth(req);

    // 2) Parse file form data
    const formData = await req.formData();
    const file = formData.get('file') as Blob | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save to public/banner
    const bannerDir = path.join(process.cwd(), 'public', 'banner');
    
    // Ensure folder exists
    await fs.mkdir(bannerDir, { recursive: true });

    // Clean up previous banners in public/banner/ directory to avoid disk bloat
    try {
      const existingFiles = await fs.readdir(bannerDir);
      for (const existingFile of existingFiles) {
        if (existingFile.startsWith('kannadasgotlatent_banner_')) {
          await fs.unlink(path.join(bannerDir, existingFile));
        }
      }
    } catch (e) {
      console.warn('Could not clean up previous banners:', e);
    }

    // Generate unique name using timestamp to prevent browser image caching issues
    const originalName = (file as any).name || 'banner.png';
    const extension = path.extname(originalName) || '.png';
    const uniqueName = `kannadasgotlatent_banner_${Date.now()}${extension}`;
    const filePath = path.join(bannerDir, uniqueName);

    // Write file to local disk
    await fs.writeFile(filePath, buffer);

    const relativeUrl = `/banner/${uniqueName}`;

    // 3) Write to Firestore settings collection to make it instantly active
    const settingsRef = adminDb.collection('settings').doc('kannadaGotLatent');
    await settingsRef.set({
      bannerUrl: relativeUrl,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return NextResponse.json({
      success: true,
      url: relativeUrl,
    });
  } catch (error: any) {
    console.error('Banner upload error:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: error.message || 'File upload failed' }, { status: 500 });
  }
}
