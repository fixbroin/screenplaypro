import { NextResponse } from 'next/server';
import { exportAllDatabaseTables } from '@/lib/backupUtils';

export async function GET(req: Request) {
  try {
    const backupData = await exportAllDatabaseTables();
    const jsonString = JSON.stringify(backupData, null, 2);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `mysql-database-complete-backup-${timestamp}.json`;

    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format');

    if (format === 'json') {
      return NextResponse.json({ success: true, data: backupData });
    }

    return new Response(jsonString, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Error generating database backup:', error);
    return NextResponse.json({ success: false, error: error.message || 'Database export failed' }, { status: 500 });
  }
}
