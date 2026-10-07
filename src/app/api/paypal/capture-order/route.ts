import { NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/mysql';
import { adminDb } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { sendUserSubscriptionActivationEmail, sendAdminSubscriptionNotificationEmail } from '@/lib/sendSubscriptionEmails';

async function getPayPalAccessToken(clientId: string, clientSecret: string, isSandbox: boolean) {
  const cleanId = clientId.trim();
  const cleanSecret = clientSecret.trim();
  const baseUrl = isSandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
  const auth = Buffer.from(`${cleanId}:${cleanSecret}`).toString('base64');

  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || 'Failed to authenticate with PayPal.');
  }

  return { accessToken: data.access_token, baseUrl };
}

export async function POST(req: NextRequest) {
  try {
    const { orderId, userId, planId = 'plan_monthly' } = await req.json();

    if (!orderId || !userId) {
      return NextResponse.json({ success: false, error: 'Missing required orderId or userId.' }, { status: 400 });
    }

    // Read PayPal config from MySQL
    let paypalClientId = process.env.PAYPAL_CLIENT_ID || '';
    let paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET || '';
    let paypalMode = (process.env.PAYPAL_MODE || 'sandbox') as 'sandbox' | 'live';

    try {
      const rows = await queryDb<any[]>(
        "SELECT setting_value FROM app_settings WHERE setting_key = 'applicationConfig'"
      );
      if (rows.length > 0) {
        const settings = JSON.parse(rows[0].setting_value || '{}');
        if (settings.paypalClientId?.trim()) paypalClientId = settings.paypalClientId.trim();
        if (settings.paypalClientSecret?.trim()) paypalClientSecret = settings.paypalClientSecret.trim();
        if (settings.paypalMode) paypalMode = settings.paypalMode;
      }
    } catch (dbErr) {
      console.warn("Could not load PayPal settings from MySQL:", dbErr);
    }

    const isSandbox = paypalMode !== 'live';
    const { accessToken, baseUrl } = await getPayPalAccessToken(paypalClientId, paypalClientSecret, isSandbox);

    // Capture payment with PayPal REST API
    const captureRes = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const captureData = await captureRes.json();

    if (!captureRes.ok || (captureData.status !== 'COMPLETED' && captureData.status !== 'APPROVED')) {
      throw new Error(captureData.message || captureData.details?.[0]?.description || 'PayPal payment capture failed.');
    }

    // Resolve plan metadata
    let durationDays = 30;
    let planName = 'Screenplay Pro Subscription';
    let planPrice = 299;

    try {
      const planDoc = await adminDb.collection('adminSubscriptionPlans').doc(planId).get();
      if (planDoc.exists) {
        const pData = planDoc.data();
        durationDays = pData?.durationDays || 30;
        planName = pData?.name || planName;
        planPrice = pData?.price || planPrice;
      } else {
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
      }
    } catch (e) {
      console.warn("Error resolving plan metadata:", e);
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    // 1. Optional Firestore User document update (safe fallback if Firestore API disabled)
    let userEmail = '';
    let userName = 'Screenwriter';
    let userMobile = '';

    try {
      const userRef = adminDb.collection('users').doc(userId);
      const userSnap = await userRef.get();
      const userData = userSnap.exists ? userSnap.data() : null;
      userEmail = userData?.email || '';
      userName = userData?.displayName || 'Screenwriter';
      userMobile = userData?.mobileNumber || '';

      await userRef.set({
        subscriptionActive: true,
        currentSubscriptionId: planId,
        subscriptionPlanName: planName,
        subscriptionExpiresAt: Timestamp.fromDate(expiresAt),
        lastSubscriptionAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now)
      }, { merge: true });

      await adminDb.collection('userSubscriptions').add({
        userId,
        planId,
        planName,
        amount: planPrice,
        startDate: Timestamp.fromDate(now),
        endDate: Timestamp.fromDate(expiresAt),
        status: 'active',
        paymentId: captureData.id || orderId,
        paymentProvider: 'paypal',
        createdAt: Timestamp.fromDate(now)
      });
    } catch (fsErr) {
      console.warn("Firestore optional sync skipped or disabled:", fsErr);
    }

    // 2. Update MySQL users and userSubscriptions tables
    const subId = `sub_paypal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    try {
      await queryDb(
        `INSERT INTO userSubscriptions (id, userId, planId, planName, amount, startDate, endDate, status, razorpayOrderId, razorpayPaymentId, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, NOW())`,
        [subId, userId, planId, planName, planPrice, orderId, captureData.id || orderId]
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
      console.error("MySQL PayPal activation error:", mysqlErr);
    }

    // 3. Update generic_collections for JSON fallback store
    const subscriptionData = {
      id: subId,
      userId: userId,
      planId: planId,
      planName: planName,
      paymentId: captureData.id || orderId,
      paymentProvider: 'paypal',
      status: 'active',
      startedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString()
    };

    await queryDb(
      "INSERT INTO generic_collections (collection_name, id, data) VALUES ('userSubscriptions', ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)",
      [subId, JSON.stringify(subscriptionData)]
    );

    const userRows = await queryDb<any[]>(
      "SELECT data FROM generic_collections WHERE collection_name = 'users' AND id = ?",
      [userId]
    );

    if (userRows.length > 0) {
      const gUserData = JSON.parse(userRows[0].data || '{}');
      gUserData.subscriptionActive = true;
      gUserData.currentSubscriptionId = planId;
      gUserData.subscriptionPlanName = planName;
      gUserData.subscriptionExpiresAt = expiresAt.toISOString();

      await queryDb(
        "UPDATE generic_collections SET data = ? WHERE collection_name = 'users' AND id = ?",
        [JSON.stringify(gUserData), userId]
      );
    }

    // 4. Send Email Notifications
    const formattedStartDate = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const formattedExpiryDate = expiresAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

    if (userEmail) {
      sendUserSubscriptionActivationEmail({
        userEmail,
        userName,
        planName,
        price: planPrice,
        startDate: formattedStartDate,
        expiryDate: formattedExpiryDate
      }).catch(err => console.error("Error sending PayPal user activation email:", err));
    }

    sendAdminSubscriptionNotificationEmail({
      userId,
      userName,
      userEmail,
      userMobile,
      planName,
      price: planPrice,
      orderId: orderId,
      startDate: formattedStartDate,
      expiryDate: formattedExpiryDate
    }).catch(err => console.error("Error sending PayPal admin notification email:", err));

    return NextResponse.json({
      success: true,
      message: 'PayPal payment captured and subscription activated successfully!',
      subscriptionId: subId,
      expiresAt: expiresAt.toISOString()
    });
  } catch (error: any) {
    console.error("Error capturing PayPal payment:", error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to capture PayPal payment.' }, { status: 500 });
  }
}
