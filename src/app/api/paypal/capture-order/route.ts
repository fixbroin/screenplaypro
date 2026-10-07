import { NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/mysql';

async function getPayPalAccessToken(clientId: string, clientSecret: string, isSandbox: boolean) {
  const baseUrl = isSandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

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
    const { orderId, userId, planId = 'plan_monthly', durationDays = 30 } = await req.json();

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

    // Activate subscription in MySQL
    const subscriptionId = `sub_paypal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (durationDays || 30) * 24 * 60 * 60 * 1000).toISOString();

    const subscriptionData = {
      id: subscriptionId,
      userId: userId,
      planId: planId,
      paymentId: captureData.id || orderId,
      paymentProvider: 'paypal',
      status: 'active',
      startedAt: now.toISOString(),
      expiresAt: expiresAt,
      createdAt: now.toISOString()
    };

    await queryDb(
      "INSERT INTO generic_collections (collection_name, id, data) VALUES ('userSubscriptions', ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)",
      [subscriptionId, JSON.stringify(subscriptionData)]
    );

    // Update user record in MySQL
    const userRows = await queryDb<any[]>(
      "SELECT data FROM generic_collections WHERE collection_name = 'users' AND id = ?",
      [userId]
    );

    if (userRows.length > 0) {
      const userData = JSON.parse(userRows[0].data || '{}');
      userData.subscriptionActive = true;
      userData.currentSubscriptionId = subscriptionId;
      userData.subscriptionExpiresAt = expiresAt;

      await queryDb(
        "UPDATE generic_collections SET data = ? WHERE collection_name = 'users' AND id = ?",
        [JSON.stringify(userData), userId]
      );
    }

    return NextResponse.json({
      success: true,
      message: 'PayPal payment captured and subscription activated successfully!',
      subscriptionId,
      expiresAt
    });
  } catch (error: any) {
    console.error("Error capturing PayPal payment:", error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to capture PayPal payment.' }, { status: 500 });
  }
}
