import { NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/mysql';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || searchParams.get('id');
    const email = searchParams.get('email');

    if (userId) {
      const rows = await queryDb<any[]>('SELECT * FROM users WHERE id = ?', [userId]);
      if (rows.length === 0) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
      return NextResponse.json({ success: true, user: rows[0] });
    }

    if (email) {
      const rows = await queryDb<any[]>('SELECT * FROM users WHERE email = ?', [email]);
      if (rows.length === 0) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
      return NextResponse.json({ success: true, user: rows[0] });
    }

    const rows = await queryDb<any[]>('SELECT * FROM users ORDER BY createdAt DESC');
    return NextResponse.json({ success: true, users: rows });
  } catch (error: any) {
    console.error('Error fetching users from MySQL:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      id, email, displayName, username, passwordHash, mobileNumber, 
      mobileNumberVerified, photoURL, isActive, roles, subscriptionActive, 
      currentSubscriptionId, subscriptionPlanName, subscriptionExpiresAt, lastSubscriptionAt 
    } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    const rolesJson = typeof roles === 'string' ? roles : JSON.stringify(roles || ['user']);

    await queryDb(
      `INSERT INTO users (
         id, email, displayName, username, passwordHash, mobileNumber, 
         mobileNumberVerified, photoURL, isActive, roles, subscriptionActive, 
         currentSubscriptionId, subscriptionPlanName, subscriptionExpiresAt, lastSubscriptionAt, createdAt, updatedAt
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         email = VALUES(email),
         displayName = VALUES(displayName),
         username = VALUES(username),
         mobileNumber = VALUES(mobileNumber),
         photoURL = VALUES(photoURL),
         isActive = VALUES(isActive),
         roles = VALUES(roles),
         subscriptionActive = VALUES(subscriptionActive),
         currentSubscriptionId = VALUES(currentSubscriptionId),
         subscriptionPlanName = VALUES(subscriptionPlanName),
         subscriptionExpiresAt = VALUES(subscriptionExpiresAt),
         lastSubscriptionAt = VALUES(lastSubscriptionAt),
         updatedAt = NOW()`,
      [
        id,
        email || '',
        displayName || '',
        username || '',
        passwordHash || '',
        mobileNumber || '',
        mobileNumberVerified ? 1 : 0,
        photoURL || '',
        isActive === undefined ? 1 : (isActive ? 1 : 0),
        rolesJson,
        subscriptionActive ? 1 : 0,
        currentSubscriptionId || null,
        subscriptionPlanName || null,
        subscriptionExpiresAt || null,
        lastSubscriptionAt || null
      ]
    );

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error('Error saving user to MySQL:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    await queryDb('DELETE FROM users WHERE id = ?', [userId]);
    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting user from MySQL:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
