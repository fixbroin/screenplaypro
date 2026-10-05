import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { fileUrl, imageUrl } = await req.json();
    const targetUrl = fileUrl || imageUrl || '';

    if (!targetUrl || !targetUrl.startsWith('/uploads/')) {
      return NextResponse.json({ success: true, message: 'Not a local file URL or no file URL provided.' });
    }

    const relativePath = targetUrl.replace(/^\/uploads\//, '');
    const targetPath = path.join(process.cwd(), 'public', 'uploads', relativePath);

    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
      console.log(`Successfully deleted local image file: ${targetPath}`);
      return NextResponse.json({ success: true, message: 'Local image file deleted successfully.' });
    } else {
      return NextResponse.json({ success: true, message: 'File did not exist on disk.' });
    }
  } catch (error: any) {
    console.error("Error deleting local image file:", error);
    return NextResponse.json({ success: false, error: error.message || 'File deletion failed.' }, { status: 500 });
  }
}
