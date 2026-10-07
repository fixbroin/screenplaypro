import { NextRequest, NextResponse } from 'next/server';
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

    const eventType = body.event_type;
    console.log(`Received PayPal Webhook Event: ${eventType}`);

    if (eventType === 'PAYMENT.CAPTURE.COMPLETED' || eventType === 'CHECKOUT.ORDER.APPROVED') {
      const resource = body.resource || {};
      const customId = resource.custom_id || resource.purchase_units?.[0]?.custom_id;
      const amountValue = resource.amount?.value;

      // Extract userId and planId if passed via custom_id or invoice_id
      if (customId) {
        const parts = customId.split(':');
        const userId = parts[0];
        const planId = parts[1] || 'plan_monthly';

        if (userId) {
          const subscriptionId = `sub_paypal_webhook_${Date.now()}`;
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
            console.warn("PayPal Webhook plan lookup error:", e);
          }

          const expiresAtDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
          const expiresAt = expiresAtDate.toISOString();

          // 1. Insert into MySQL userSubscriptions
          try {
            await queryDb(
              `INSERT INTO userSubscriptions (id, userId, planId, planName, amount, startDate, endDate, status, razorpayOrderId, razorpayPaymentId, createdAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, NOW())`,
              [subscriptionId, userId, planId, planName, planPrice, now, expiresAtDate, resource.id || 'paypal_webhook', resource.id || 'paypal_webhook']
            );
          } catch (mSubErr) {
            console.warn("PayPal Webhook userSubscriptions table update warning:", mSubErr);
          }

          // 2. Insert into generic_collections
          const subscriptionData = {
            id: subscriptionId,
            userId: userId,
            planId: planId,
            planName: planName,
            paymentId: resource.id || 'paypal_webhook',
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

          // 3. Update Firestore (optional fallback)
          try {
            const { adminDb } = await import('@/lib/firebaseAdmin');
            if (adminDb) {
              const { Timestamp } = await import('firebase-admin/firestore');
              const userRef = adminDb.collection('users').doc(userId);
              await userRef.set({
                subscriptionActive: true,
                currentSubscriptionId: planId,
                subscriptionPlanName: planName,
                subscriptionExpiresAt: Timestamp.fromDate(expiresAtDate),
                lastSubscriptionAt: Timestamp.fromDate(now),
                updatedAt: Timestamp.fromDate(now)
              }, { merge: true });
            }
          } catch (fsErr) {
            // Quiet fallback
          }

          // 4. Update MySQL users table
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
            console.warn("PayPal Webhook MySQL sync warning:", myErr);
          }

          console.log(`PayPal Webhook: Activated subscription ${planName} (${durationDays} days) for user ${userId}`);
        }
      }
    }

    return NextResponse.json({ success: true, message: 'PayPal Webhook event received.' });
  } catch (error: any) {
    console.error("Error processing PayPal webhook:", error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
