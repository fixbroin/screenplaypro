import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { sendUserSubscriptionExpiryEmail } from '@/lib/sendSubscriptionEmails';

export async function POST(req: NextRequest) {
  try {
    const { userId, userEmail, userName, planName, expiryDate } = await req.json();

    if (!userEmail) {
      return NextResponse.json({ success: false, error: 'User email is required.' }, { status: 400 });
    }

    let targetName = userName || 'Screenwriter';
    let targetPlan = planName || 'Screenplay Pro Subscription';
    let targetExpiry = expiryDate || 'Recently';

    // If userId provided, pull details from user doc if available
    if (userId) {
      const userDoc = await adminDb.collection('users').doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        targetName = userData?.displayName || targetName;
        targetPlan = userData?.subscriptionPlanName || targetPlan;
        
        if (userData?.subscriptionExpiresAt) {
          const expiresMillis = typeof userData.subscriptionExpiresAt.toMillis === 'function'
            ? userData.subscriptionExpiresAt.toMillis()
            : (userData.subscriptionExpiresAt as any)?._seconds 
              ? (userData.subscriptionExpiresAt as any)._seconds * 1000 
              : 0;
          if (expiresMillis) {
            targetExpiry = new Date(expiresMillis).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric'
            });
          }
        }
      }
    }

    const sent = await sendUserSubscriptionExpiryEmail({
      userEmail,
      userName: targetName,
      planName: targetPlan,
      expiryDate: targetExpiry
    });

    if (!sent) {
      return NextResponse.json({ success: false, error: 'Failed to send expiry email. Please check SMTP configuration in Admin Settings.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Expiry renewal email sent successfully.' });
  } catch (error: any) {
    console.error("Error sending manual expiry email:", error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
