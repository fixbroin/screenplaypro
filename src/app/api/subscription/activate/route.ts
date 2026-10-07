import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { sendUserSubscriptionActivationEmail, sendAdminSubscriptionNotificationEmail } from '@/lib/sendSubscriptionEmails';

export async function POST(req: NextRequest) {
  try {
    const { 
      userId, 
      planId, 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      isTestMode
    } = await req.json();

    if (!userId || !planId) {
      return NextResponse.json({ success: false, error: 'Missing required user ID or plan ID.' }, { status: 400 });
    }

    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    // 1. Verify Razorpay Signature if not in test mode and credentials exist
    if (!isTestMode && razorpayKeySecret && razorpay_order_id && razorpay_payment_id && razorpay_signature) {
      const body = `${razorpay_order_id}|${razorpay_payment_id}`;
      const expectedSignature = crypto
        .createHmac('sha256', razorpayKeySecret)
        .update(body.toString())
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        return NextResponse.json({ success: false, error: 'Invalid payment signature.' }, { status: 400 });
      }
    } else if (!isTestMode && (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)) {
      if (razorpayKeySecret) {
        return NextResponse.json({ success: false, error: 'Missing required Razorpay payment details.' }, { status: 400 });
      }
    }

    // 2. Fetch Plan Details from MySQL / Firestore or defaults
    let durationDays = 30;
    let planName = 'Screenplay Pro Subscription';
    let planPrice = 299;

    try {
      const planDoc = await adminDb.collection('adminSubscriptionPlans').doc(planId).get();
      if (planDoc.exists) {
        const planData = planDoc.data();
        durationDays = planData?.durationDays || 30;
        planName = planData?.name || planName;
        planPrice = planData?.price || planPrice;
      }
    } catch (e) {
      // Fallback to MySQL query
      try {
        const { queryDb } = await import('@/lib/mysql');
        const rows = await queryDb<any[]>("SELECT * FROM adminSubscriptionPlans WHERE id = ?", [planId]);
        if (rows.length > 0) {
          durationDays = Number(rows[0].durationDays || 30);
          planName = rows[0].name || planName;
          planPrice = Number(rows[0].price || planPrice);
        } else if (planId === 'plan_annual') {
          durationDays = 365;
          planName = 'Annual Pro Pass';
          planPrice = 1999;
        } else if (planId === 'plan_lifetime') {
          durationDays = 3650;
          planName = 'Lifetime Writer Pass';
          planPrice = 4999;
        } else {
          durationDays = 30;
          planName = 'Monthly Writer Pass';
          planPrice = 299;
        }
      } catch (dbErr) {
        console.warn("Error loading plan details from MySQL:", dbErr);
      }
    }

    // 3. Update User Subscription in Firestore (optional) & fetch User info
    let userEmail = '';
    let userName = 'Screenwriter';
    let userMobile = '';

    const now = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(now.getDate() + durationDays);

    try {
      const userRef = adminDb.collection('users').doc(userId);
      const userSnap = await userRef.get();
      const userData = userSnap.exists ? userSnap.data() : null;
      userEmail = userData?.email || '';
      userName = userData?.displayName || 'Screenwriter';
      userMobile = userData?.mobileNumber || '';

      const subscriptionData = {
        subscriptionActive: true,
        currentSubscriptionId: planId,
        subscriptionPlanName: planName,
        subscriptionExpiresAt: Timestamp.fromDate(expiresAt),
        lastSubscriptionAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now)
      };

      await userRef.set(subscriptionData, { merge: true });

      await adminDb.collection('userSubscriptions').add({
        userId,
        planId,
        planName,
        amount: planPrice,
        startDate: Timestamp.fromDate(now),
        endDate: Timestamp.fromDate(expiresAt),
        status: 'active',
        razorpayOrderId: razorpay_order_id || 'test_order',
        razorpayPaymentId: razorpay_payment_id || 'test_payment',
        createdAt: Timestamp.fromDate(now)
      });
    } catch (fsErr) {
      console.warn("Firestore optional activation sync skipped:", fsErr);
    }

    try {
      const { queryDb } = await import('@/lib/mysql');
      const subId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await queryDb(
        `INSERT INTO userSubscriptions (id, userId, planId, planName, amount, startDate, endDate, status, razorpayOrderId, razorpayPaymentId, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, NOW())`,
        [subId, userId, planId, planName, planPrice, now, expiresAt, razorpay_order_id || 'test_order', razorpay_payment_id || 'test_payment']
      );
      await queryDb(
        `UPDATE users SET 
           subscriptionActive = 1,
           currentSubscriptionId = ?,
           subscriptionPlanName = ?,
           subscriptionExpiresAt = ?,
           lastSubscriptionAt = NOW(),
           updatedAt = NOW()
         WHERE id = ?`,
        [planId, planName, expiresAt, userId]
      );
    } catch (mysqlErr) {
      console.error("MySQL activation sync error:", mysqlErr);
    }

    const formattedStartDate = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const formattedExpiryDate = expiresAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    // 5. Send User & Admin HTML Email Notifications asynchronously
    if (userEmail) {
      sendUserSubscriptionActivationEmail({
        userEmail,
        userName,
        planName,
        price: planPrice,
        startDate: formattedStartDate,
        expiryDate: formattedExpiryDate
      }).catch(err => console.error("Error triggering user activation email:", err));
    }

    sendAdminSubscriptionNotificationEmail({
      userId,
      userName,
      userEmail,
      userMobile,
      planName,
      price: planPrice,
      orderId: razorpay_order_id || razorpay_payment_id || 'Direct Activation',
      startDate: formattedStartDate,
      expiryDate: formattedExpiryDate
    }).catch(err => console.error("Error triggering admin subscription notification email:", err));

    return NextResponse.json({ 
      success: true, 
      message: 'Subscription activated successfully.',
      expiresAt: expiresAt.toISOString()
    });

  } catch (error) {
    console.error('Error activating subscription:', error);
    return NextResponse.json({ success: false, error: 'Internal server error.' }, { status: 500 });
  }
}
