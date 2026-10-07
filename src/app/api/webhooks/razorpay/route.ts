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
        const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const now = new Date();

        let durationDays = 30;
        let planName = 'Screenplay Pro Subscription';
        let planPrice = 299;

        try {
          const planRows = await queryDb<any[]>("SELECT * FROM adminSubscriptionPlans WHERE id = ?", [planId]);
          if (planRows.length > 0) {
            durationDays = Number(planRows[0].durationDays || 30);
            planName = planRows[0].name || planName;
            planPrice = Number(planRows[0].price || planPrice);
          } else if (planId === 'plan_annual') {
            durationDays = 365;
            planName = 'Annual Pro Pass';
            planPrice = 1999;
          } else if (planId === 'plan_lifetime') {
            durationDays = 3650;
            planName = 'Lifetime Writer Pass';
            planPrice = 4999;
          }
        } catch (e) {
          console.warn("Razorpay Webhook plan lookup error:", e);
        }

        const expiresAtDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
        const expiresAt = expiresAtDate.toISOString();

        // 1. Insert into MySQL userSubscriptions
        try {
          await queryDb(
            `INSERT INTO userSubscriptions (id, userId, planId, planName, amount, startDate, endDate, status, razorpayOrderId, razorpayPaymentId, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, NOW())`,
            [subscriptionId, userId, planId, planName, planPrice, now, expiresAtDate, paymentEntity.order_id || 'razorpay_webhook', paymentEntity.id || 'razorpay_webhook']
          );
        } catch (mSubErr) {
          console.warn("Razorpay Webhook userSubscriptions insert warning:", mSubErr);
        }

        // 2. Update MySQL users table
        try {
          await queryDb(
            `UPDATE users SET 
               subscriptionActive = 1,
               currentSubscriptionId = ?,
               subscriptionPlanName = ?,
               subscriptionExpiresAt = ?,
               lastSubscriptionAt = NOW(),
               updatedAt = NOW()
             WHERE id = ?`,
            [planId, planName, expiresAtDate, userId]
          );
        } catch (myErr) {
          console.warn("Razorpay Webhook MySQL users update warning:", myErr);
        }

        // 3. Insert into generic_collections
        const subscriptionData = {
          id: subscriptionId,
          userId: userId,
          planId: planId,
          planName: planName,
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

        console.log(`Razorpay Webhook: Activated subscription ${planName} (${durationDays} days) for user ${userId}`);
      }
    }

    return NextResponse.json({ success: true, message: 'Webhook event processed.' });
  } catch (error: any) {
    console.error("Error processing Razorpay webhook:", error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
