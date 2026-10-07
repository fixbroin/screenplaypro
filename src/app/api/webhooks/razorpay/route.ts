import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { queryDb } from '@/lib/mysql';

export async function POST(req: NextRequest) {
  try {
    const bodyText = await req.text();
    let body: any = {};
    try {
      body = JSON.parse(bodyText);
    } catch (e) {
      return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
    }

    // Load Razorpay Webhook Secret from applicationConfig in app_settings table
    let webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    try {
      const rows = await queryDb<any[]>(
        "SELECT setting_value FROM app_settings WHERE setting_key = 'applicationConfig'"
      );
      if (rows.length > 0) {
        const settings = JSON.parse(rows[0].setting_value || '{}');
        if (settings.razorpayWebhookSecret?.trim()) {
          webhookSecret = settings.razorpayWebhookSecret.trim();
        }
      }
    } catch (dbErr) {
      console.warn("Error reading razorpayWebhookSecret from app_settings:", dbErr);
    }

    // Signature verification if secret is set
    if (webhookSecret) {
      const signature = req.headers.get('x-razorpay-signature');
      if (!signature) {
        return NextResponse.json({ success: false, error: 'Missing Razorpay signature header.' }, { status: 400 });
      }

      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(bodyText)
        .digest('hex');

      if (signature !== expectedSignature) {
        console.error("Razorpay webhook signature mismatch!");
        return NextResponse.json({ success: false, error: 'Invalid webhook signature.' }, { status: 400 });
      }
    }

    const event = body.event;
    console.log(`Received Razorpay Webhook Event: ${event}`);

    if (event === 'payment.captured' || event === 'order.paid' || event === 'subscription.charged') {
      const paymentEntity = body.payload?.payment?.entity || body.payload?.order?.entity || {};
      const notes = paymentEntity.notes || {};
      const userId = notes.userId || notes.user_id;
      const planId = notes.planId || notes.plan_id;

      if (userId && planId) {
        // Activate subscription in MySQL userSubscriptions
        const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const subscriptionData = {
          id: subscriptionId,
          userId: userId,
          planId: planId,
          paymentId: paymentEntity.id || 'razorpay_webhook',
          status: 'active',
          startedAt: now.toISOString(),
          expiresAt: expiresAt,
          createdAt: now.toISOString()
        };

        await queryDb(
          "INSERT INTO generic_collections (collection_name, id, data) VALUES ('userSubscriptions', ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)",
          [subscriptionId, JSON.stringify(subscriptionData)]
        );

        // Update user record
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

        console.log(`Razorpay Webhook: Activated subscription ${subscriptionId} for user ${userId}`);
      }
    }

    return NextResponse.json({ success: true, message: 'Webhook event processed.' });
  } catch (error: any) {
    console.error("Error processing Razorpay webhook:", error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
