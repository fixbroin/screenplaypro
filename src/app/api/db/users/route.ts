import { NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/mysql';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

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
         email = COALESCE(NULLIF(VALUES(email), ''), users.email),
         displayName = COALESCE(NULLIF(VALUES(displayName), ''), users.displayName),
         username = COALESCE(NULLIF(VALUES(username), ''), users.username),
         mobileNumber = COALESCE(NULLIF(VALUES(mobileNumber), ''), users.mobileNumber),
         photoURL = COALESCE(NULLIF(VALUES(photoURL), ''), users.photoURL),
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

    // 1. Fetch user data from MySQL first to extract email and mobileNumber if available
    let mysqlUser: { id: string; email?: string; mobileNumber?: string } | null = null;
    try {
      const userRows = await queryDb<any[]>('SELECT id, email, mobileNumber FROM users WHERE id = ?', [userId]);
      if (userRows && userRows.length > 0) {
        mysqlUser = userRows[0];
      }
    } catch (e) {
      console.warn('[Users API DELETE] Failed to fetch user details from MySQL before deletion:', e);
    }

    // 2. Delete user from Firebase Auth
    if (adminAuth) {
      let deletedFromAuth = false;
      // First attempt: Delete directly by UID (userId is standard Firebase Auth UID)
      try {
        await adminAuth.deleteUser(userId);
        deletedFromAuth = true;
        console.log(`[Users API DELETE] Deleted Firebase Auth user by UID: ${userId}`);
      } catch (authErr: any) {
        if (authErr.code !== 'auth/user-not-found') {
          console.warn(`[Users API DELETE] Error deleting Firebase Auth user by UID (${userId}):`, authErr?.message || authErr);
        }
      }

      // Second attempt: Delete by Email if UID lookup was not found
      if (!deletedFromAuth && mysqlUser?.email) {
        try {
          const userRecord = await adminAuth.getUserByEmail(mysqlUser.email);
          if (userRecord?.uid) {
            await adminAuth.deleteUser(userRecord.uid);
            deletedFromAuth = true;
            console.log(`[Users API DELETE] Deleted Firebase Auth user by Email (${mysqlUser.email}, UID: ${userRecord.uid})`);
          }
        } catch (emailErr: any) {
          if (emailErr.code !== 'auth/user-not-found') {
            console.warn(`[Users API DELETE] Error looking up Firebase Auth user by Email:`, emailErr?.message || emailErr);
          }
        }
      }

      // Third attempt: Delete by Phone Number if still not deleted
      if (!deletedFromAuth && mysqlUser?.mobileNumber) {
        try {
          let phone = mysqlUser.mobileNumber.replace(/\D/g, '');
          if (phone) {
            if (!phone.startsWith('+')) {
              phone = phone.length === 10 ? `+91${phone}` : `+${phone}`;
            }
            const userRecord = await adminAuth.getUserByPhoneNumber(phone);
            if (userRecord?.uid) {
              await adminAuth.deleteUser(userRecord.uid);
              deletedFromAuth = true;
              console.log(`[Users API DELETE] Deleted Firebase Auth user by Phone (${phone}, UID: ${userRecord.uid})`);
            }
          }
        } catch (phoneErr: any) {
          if (phoneErr.code !== 'auth/user-not-found') {
            console.warn(`[Users API DELETE] Error looking up Firebase Auth user by Phone:`, phoneErr?.message || phoneErr);
          }
        }
      }
    } else {
      console.warn('[Users API DELETE] adminAuth is null or not configured. Skipping Firebase Auth deletion.');
    }

    // 3. Clean up Firestore documents if adminDb is available
    if (adminDb) {
      try {
        await Promise.all([
          adminDb.collection('users').doc(userId).delete().catch(() => {}),
          adminDb.collection('accountDeletionRequests').doc(userId).delete().catch(() => {})
        ]);
        console.log(`[Users API DELETE] Cleaned Firestore documents for user: ${userId}`);
      } catch (fsErr) {
        console.warn('[Users API DELETE] Firestore cleanup warning:', fsErr);
      }
    }

    // 4. Delete user record and related records from MySQL
    await queryDb('DELETE FROM users WHERE id = ?', [userId]);
    await queryDb('DELETE FROM accountDeletionRequests WHERE id = ? OR userId = ?', [userId, userId]).catch(() => {});
    await queryDb('DELETE FROM userSubscriptions WHERE userId = ?', [userId]).catch(() => {});

    return NextResponse.json({ success: true, message: 'User account completely removed from Firebase Auth and MySQL.' });
  } catch (error: any) {
    console.error('Error deleting user from database:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
