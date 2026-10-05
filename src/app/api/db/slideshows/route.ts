import { NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/mysql';

export async function GET() {
  try {
    const rows = await queryDb<any[]>('SELECT * FROM slideshows ORDER BY `order` ASC');
    const slides = rows.map(r => ({
      id: r.id,
      title: r.title || '',
      subtitle: r.subtitle || '',
      description: r.subtitle || '',
      imageUrl: r.imageUrl,
      imageHint: r.imageHint || '',
      ctaText: r.ctaText || '',
      buttonText: r.ctaText || '',
      ctaLink: r.ctaLink || '',
      buttonLinkValue: r.ctaLink || '',
      buttonLinkType: r.buttonLinkType || (r.ctaLink && !r.ctaLink.startsWith('http') && !r.ctaLink.startsWith('/') ? 'category' : 'url'),
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
    const { id, title, subtitle, description, imageUrl, imageHint, ctaText, buttonText, ctaLink, buttonLinkValue, buttonLinkType, order, isActive } = body;

    const slideId = id || `slide_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const finalTitle = title || '';
    const finalSubtitle = subtitle || description || '';
    const finalCtaText = ctaText || buttonText || '';
    const finalCtaLink = ctaLink || buttonLinkValue || '';
    const finalLinkType = buttonLinkType || 'url';
    const finalImageHint = imageHint || '';

    await queryDb(
      `INSERT INTO slideshows (id, title, subtitle, imageUrl, imageHint, ctaText, ctaLink, buttonLinkType, \`order\`, isActive, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         title = VALUES(title),
         subtitle = VALUES(subtitle),
         imageUrl = VALUES(imageUrl),
         imageHint = VALUES(imageHint),
         ctaText = VALUES(ctaText),
         ctaLink = VALUES(ctaLink),
         buttonLinkType = VALUES(buttonLinkType),
         \`order\` = VALUES(\`order\`),
         isActive = VALUES(isActive),
         updatedAt = NOW()`,
      [
        slideId,
        finalTitle,
        finalSubtitle,
        imageUrl || '',
        finalImageHint,
        finalCtaText,
        finalCtaLink,
        finalLinkType,
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
