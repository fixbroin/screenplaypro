import { NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/mysql';

export async function GET() {
  try {
    const rows = await queryDb<any[]>('SELECT * FROM adminSubscriptionPlans ORDER BY `order` ASC');
    const plans = rows.map(r => ({
      id: r.id,
      name: r.name,
      price: Number(r.price),
      durationDays: Number(r.durationDays),
      features: typeof r.features === 'string' ? JSON.parse(r.features || '[]') : (r.features || []),
      isActive: Boolean(r.isActive),
      order: Number(r.order || 1),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));
    return NextResponse.json({ success: true, plans });
  } catch (error: any) {
    console.error('Error fetching plans from MySQL:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, price, durationDays, features, isActive, order } = body;
    const planId = id || `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const featuresJson = typeof features === 'string' ? features : JSON.stringify(features || []);

    await queryDb(
      `INSERT INTO adminSubscriptionPlans (id, name, price, durationDays, features, isActive, \`order\`, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         price = VALUES(price),
         durationDays = VALUES(durationDays),
         features = VALUES(features),
         isActive = VALUES(isActive),
         \`order\` = VALUES(\`order\`),
         updatedAt = NOW()`,
      [
        planId,
        name || '',
        Number(price || 0),
        Number(durationDays || 30),
        featuresJson,
        isActive ? 1 : 0,
        Number(order || 1)
      ]
    );

    return NextResponse.json({ success: true, id: planId });
  } catch (error: any) {
    console.error('Error saving subscription plan to MySQL:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'Missing plan ID' }, { status: 400 });

    await queryDb('DELETE FROM adminSubscriptionPlans WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting plan from MySQL:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
