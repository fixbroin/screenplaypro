import { NextResponse } from 'next/server';
import { queryDb } from '@/lib/mysql';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await queryDb<any[]>('SELECT setting_value FROM app_settings WHERE setting_key = ?', ['marketingConfiguration']);
    let adsTxtContent = "";
    if (rows && rows.length > 0) {
      try {
        const settings = typeof rows[0].setting_value === 'string' ? JSON.parse(rows[0].setting_value) : rows[0].setting_value;
        adsTxtContent = settings?.adsTxtContent || "";
      } catch (e) {}
    }

    return new NextResponse(adsTxtContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error("Error fetching ads.txt content from MySQL:", error);
    return new NextResponse("Error fetching ads.txt content.", {
      status: 500,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }
}