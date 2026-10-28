import { NextRequest, NextResponse } from 'next/server';
import { restoreAllDatabaseTables } from '@/lib/backupUtils';

export async function POST(req: NextRequest) {
  try {
    let backupJson: any = null;

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ success: false, error: 'No JSON backup file uploaded' }, { status: 400 });
      }
      const text = await file.text();
      backupJson = JSON.parse(text);
    } else {
      backupJson = await req.json();
    }

    if (!backupJson) {
      return NextResponse.json({ success: false, error: 'No valid backup data received' }, { status: 400 });
    }

    const result = await restoreAllDatabaseTables(backupJson);

    return NextResponse.json({
      message: `Database restore completed: ${result.totalRestored} record(s) restored across tables.`,
      ...result
    });
  } catch (error: any) {
    console.error('Error restoring database backup:', error);
    return NextResponse.json({ success: false, error: error.message || 'Database restore failed' }, { status: 500 });
  }
}
