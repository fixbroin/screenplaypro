import { NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/mysql';

export async function GET() {
  try {
    const rows = await queryDb<any[]>("SELECT config FROM webSettings WHERE id = 'global'");
    if (rows.length === 0) {
      return NextResponse.json({ success: true, settings: {} });
    }
    const config = typeof rows[0].config === 'string' ? JSON.parse(rows[0].config || '{}') : rows[0].config;
    return NextResponse.json({ success: true, settings: config });
  } catch (error: any) {
    console.error('Error fetching web settings from MySQL:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const configJson = typeof body === 'string' ? body : JSON.stringify(body || {});

    await queryDb(
      `INSERT INTO webSettings (id, config, updatedAt)
       VALUES ('global', ?, NOW())
       ON DUPLICATE KEY UPDATE config = VALUES(config), updatedAt = NOW()`,
      [configJson]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error saving web settings to MySQL:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
