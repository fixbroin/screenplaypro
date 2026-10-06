import { type NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { queryDb } from '@/lib/mysql';

export async function POST(req: NextRequest) {
  try {
    // 1. Security Check: Only allow Admins
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    if (!adminAuth) {
      return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    
    // Verify email matches the admin email
    if (decodedToken.email?.toLowerCase() !== 'fixbro.in@gmail.com') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { targetUserId } = await req.json();
    if (!targetUserId) {
      return NextResponse.json({ error: 'Target User ID is required' }, { status: 400 });
    }

    console.log(`[Admin Delete] Initiating deletion for user: ${targetUserId} by admin ${decodedToken.email}`);

    // Fetch user details from MySQL before deleting
    let mysqlUser: { id: string; email?: string; mobileNumber?: string } | null = null;
    try {
      const userRows = await queryDb<any[]>('SELECT id, email, mobileNumber FROM users WHERE id = ?', [targetUserId]);
      if (userRows && userRows.length > 0) {
        mysqlUser = userRows[0];
      }
    } catch (e) {
      console.warn('[Admin Delete] Failed to fetch user from MySQL before deletion:', e);
    }

    // 2. Delete from Firebase Authentication
    let deletedFromAuth = false;
    try {
      await adminAuth.deleteUser(targetUserId);
      deletedFromAuth = true;
      console.log(`[Admin Delete] Successfully deleted user auth for: ${targetUserId}`);
    } catch (authError: any) {
      if (authError.code === 'auth/user-not-found') {
        console.log(`[Admin Delete] User auth not found by UID, trying email search for: ${targetUserId}`);
      } else {
        console.warn(`[Admin Delete] Error deleting auth by UID:`, authError?.message);
      }
    }

    if (!deletedFromAuth && mysqlUser?.email) {
      try {
        const userRecord = await adminAuth.getUserByEmail(mysqlUser.email);
        if (userRecord?.uid) {
          await adminAuth.deleteUser(userRecord.uid);
          deletedFromAuth = true;
          console.log(`[Admin Delete] Successfully deleted user auth by Email: ${mysqlUser.email}`);
        }
      } catch (e) {
        // ignore user-not-found
      }
    }

    // 3. Delete Firestore database records
    if (adminDb) {
      const dbCleanups = [
        adminDb.collection('users').doc(targetUserId).delete().catch(() => {}),
        adminDb.collection('accountDeletionRequests').doc(targetUserId).delete().catch(() => {})
      ];
      await Promise.all(dbCleanups);
      console.log(`[Admin Delete] Successfully cleaned up all Firestore records for: ${targetUserId}`);
    }

    // 4. Delete MySQL database records
    try {
      await queryDb('DELETE FROM users WHERE id = ?', [targetUserId]);
      await queryDb('DELETE FROM accountDeletionRequests WHERE id = ? OR userId = ?', [targetUserId, targetUserId]).catch(() => {});
      await queryDb('DELETE FROM userSubscriptions WHERE userId = ?', [targetUserId]).catch(() => {});
      console.log(`[Admin Delete] Successfully deleted MySQL records for: ${targetUserId}`);
    } catch (mysqlErr) {
      console.error('[Admin Delete] Error deleting MySQL records:', mysqlErr);
    }

    return NextResponse.json({ 
      success: true, 
      message: `User account and records for "${targetUserId}" have been deleted successfully from Firebase and MySQL.` 
    });

  } catch (error: any) {
    console.error('[Admin Delete] Error processing account deletion:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
