import { type NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/mysql';

/**
 * This API route is called by navigator.sendBeacon to update user activity in MySQL.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { uid, ts } = body;

    if (!uid || typeof uid !== 'string' || !ts || typeof ts !== 'number') {
      return NextResponse.json({ success: false, error: 'Invalid payload.' }, { status: 400 });
    }

    const dateStr = new Date(ts).toISOString().slice(0, 19).replace('T', ' ');
    await queryDb('UPDATE users SET lastLoginAt = ? WHERE id = ?', [dateStr, uid]).catch((err) => {
      console.warn('Could not update lastLoginAt in MySQL users:', err?.message || err);
    });
    
    return new NextResponse(null, { status: 204 });

  } catch (error: any) {
    console.error('Error in /api/mark-last-seen:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
