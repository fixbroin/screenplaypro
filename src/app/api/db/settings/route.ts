import { NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/mysql';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');

    if (key) {
      const rows = await queryDb<any[]>('SELECT setting_value FROM app_settings WHERE setting_key = ?', [key]);
      if (!rows || rows.length === 0) {
        return NextResponse.json({ success: true, data: null });
      }
      let parsed = null;
      try {
        parsed = JSON.parse(rows[0].setting_value);
      } catch (e) {
        parsed = rows[0].setting_value;
      }
      return NextResponse.json({ success: true, data: parsed });
    }

    // Return all settings if no key provided
    const rows = await queryDb<any[]>('SELECT setting_key, setting_value FROM app_settings');
    const result: Record<string, any> = {};
    for (const row of rows) {
      try {
        result[row.setting_key] = JSON.parse(row.setting_value);
      } catch {
        result[row.setting_key] = row.setting_value;
      }
    }
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error fetching settings from MySQL:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { key, data } = body;

    if (!key) {
      return NextResponse.json({ success: false, error: 'Key is required' }, { status: 400 });
    }

    const valueStr = typeof data === 'string' ? data : JSON.stringify(data ?? {});

    await queryDb(
      `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?`,
      [key, valueStr, valueStr]
    );

    return NextResponse.json({ success: true, key, data });
  } catch (error: any) {
    console.error('Error saving setting to MySQL:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
