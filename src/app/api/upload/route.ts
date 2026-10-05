import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = (formData.get('file') as File | null) || (formData.get('image') as File | null);
    const folder = (formData.get('folder') as string) || 'general';
    const oldFileUrl = (formData.get('oldFileUrl') as string) || (formData.get('oldImageUrl') as string) || '';

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided.' }, { status: 400 });
    }

    // Clean folder name to prevent path traversal
    const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || 'general';

    // Ensure target uploads folder exists inside public directory
    const targetDir = path.join(process.cwd(), 'public', 'uploads', safeFolder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 1. Delete old image if replacing an existing image
    if (oldFileUrl && oldFileUrl.startsWith('/uploads/')) {
      try {
        const relativePath = oldFileUrl.replace(/^\/uploads\//, '');
        const oldFilePath = path.join(process.cwd(), 'public', 'uploads', relativePath);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
          console.log(`Deleted old image: ${oldFilePath}`);
        }
      } catch (delErr) {
        console.warn("Could not delete old image:", delErr);
      }
    }

    // 2. Generate unique filename and save to local storage
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const fileExt = path.extname(file.name) || '.png';
    const filename = `${nanoid()}${fileExt}`;
    const filePath = path.join(targetDir, filename);

    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/${safeFolder}/${filename}`;

    return NextResponse.json({
      success: true,
      fileUrl: publicUrl,
      url: publicUrl,
      filename
    });
  } catch (error: any) {
    console.error("Error in local file upload:", error);
    return NextResponse.json({ success: false, error: error.message || 'Upload failed.' }, { status: 500 });
  }
}
