import { NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/mysql';

export async function GET() {
  try {
    const rows = await queryDb<any[]>('SELECT * FROM slideshows ORDER BY `order` ASC');
    const slides = rows.map(r => ({
      id: r.id,
      title: r.title || '',
      subtitle: r.subtitle || '',
      imageUrl: r.imageUrl,
      ctaText: r.ctaText || '',
      ctaLink: r.ctaLink || '',
      order: Number(r.order || 0),
      isActive: Boolean(r.isActive),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));
    return NextResponse.json({ success: true, slides });
  } catch (error: any) {
    console.error('Error fetching slideshows from MySQL:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, title, subtitle, imageUrl, ctaText, ctaLink, order, isActive } = body;

    const slideId = id || `slide_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    await queryDb(
      `INSERT INTO slideshows (id, title, subtitle, imageUrl, ctaText, ctaLink, \`order\`, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         title = VALUES(title),
         subtitle = VALUES(subtitle),
         imageUrl = VALUES(imageUrl),
         ctaText = VALUES(ctaText),
         ctaLink = VALUES(ctaLink),
         \`order\` = VALUES(\`order\`),
         isActive = VALUES(isActive),
         updatedAt = NOW()`,
      [
        slideId,
        title || '',
        subtitle || '',
        imageUrl || '',
        ctaText || '',
        ctaLink || '',
        Number(order || 0),
        isActive ? 1 : 0
      ]
    );

    return NextResponse.json({ success: true, id: slideId });
  } catch (error: any) {
    console.error('Error saving slideshow to MySQL:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slideId = searchParams.get('slideId');
    if (!slideId) return NextResponse.json({ success: false, error: 'Missing slideId' }, { status: 400 });

    await queryDb('DELETE FROM slideshows WHERE id = ?', [slideId]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting slideshow from MySQL:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
