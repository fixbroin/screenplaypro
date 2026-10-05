import { type NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    // 1. Security Check: Only allow Admins
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
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

    // 2. Delete from Firebase Authentication
    try {
      await adminAuth.deleteUser(targetUserId);
      console.log(`[Admin Delete] Successfully deleted user auth for: ${targetUserId}`);
    } catch (authError: any) {
      // If user doesn't exist in auth anymore, we log and proceed to clean database documents
      if (authError.code === 'auth/user-not-found') {
        console.log(`[Admin Delete] User auth not found, proceeding with document deletion for: ${targetUserId}`);
      } else {
        throw authError;
      }
    }

    // 3. Delete database records in parallel
    const dbCleanups = [
      adminDb.collection('users').doc(targetUserId).delete(),
      adminDb.collection('ArtistApplications').doc(targetUserId).delete(),
      adminDb.collection('accountDeletionRequests').doc(targetUserId).delete()
    ];

    await Promise.all(dbCleanups);
    console.log(`[Admin Delete] Successfully cleaned up all database records for: ${targetUserId}`);

    return NextResponse.json({ 
      success: true, 
      message: `User account and records for "${targetUserId}" have been deleted successfully.` 
    });

  } catch (error: any) {
    console.error('[Admin Delete] Error processing account deletion:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
