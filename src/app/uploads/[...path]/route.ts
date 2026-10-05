import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params;
    const pathSegments = resolvedParams.path || [];
    
    // Prevent path traversal attacks
    const safeSegments = pathSegments.map(s => s.replace(/[^a-zA-Z0-9_.-]/g, ''));
    const relativePath = safeSegments.join('/');

    if (!relativePath) {
      return new NextResponse('File not found', { status: 404 });
    }

    // Check primary location: public/uploads/...
    let filePath = path.join(process.cwd(), 'public', 'uploads', relativePath);
    
    // Check secondary fallback for Next.js standalone build
    if (!fs.existsSync(filePath)) {
      filePath = path.join(process.cwd(), '..', 'public', 'uploads', relativePath);
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      return new NextResponse('File not found', { status: 404 });
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.pdf': 'application/pdf',
      '.json': 'application/json',
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';
    const fileBuffer = fs.readFileSync(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error serving uploaded file:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
