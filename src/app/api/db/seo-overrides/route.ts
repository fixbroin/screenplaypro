import { NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/mysql';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const path = searchParams.get('path');

    if (path) {
      const rows = await queryDb<any[]>('SELECT * FROM seoOverrides WHERE path = ?', [path]);
      if (rows.length === 0) return NextResponse.json({ success: true, seo: null });
      return NextResponse.json({ success: true, seo: rows[0] });
    }

    const rows = await queryDb<any[]>('SELECT * FROM seoOverrides ORDER BY path ASC');
    return NextResponse.json({ success: true, overrides: rows });
  } catch (error: any) {
    console.error('Error fetching SEO overrides from MySQL:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, path, h1_title, seo_title, seo_description, seo_keywords } = body;
    const seoId = id || `seo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    if (!path) {
      return NextResponse.json({ success: false, error: 'Path is required' }, { status: 400 });
    }

    await queryDb(
      `INSERT INTO seoOverrides (id, path, h1_title, seo_title, seo_description, seo_keywords, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         h1_title = VALUES(h1_title),
         seo_title = VALUES(seo_title),
         seo_description = VALUES(seo_description),
         seo_keywords = VALUES(seo_keywords),
         updatedAt = NOW()`,
      [
        seoId,
        path,
        h1_title || '',
        seo_title || '',
        seo_description || '',
        seo_keywords || ''
      ]
    );

    return NextResponse.json({ success: true, id: seoId });
  } catch (error: any) {
    console.error('Error saving SEO override to MySQL:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'Missing ID' }, { status: 400 });

    await queryDb('DELETE FROM seoOverrides WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting SEO override from MySQL:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
