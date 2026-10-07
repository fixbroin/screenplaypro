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
          const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

          const subscriptionData = {
            id: subscriptionId,
            userId: userId,
            planId: planId,
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

          console.log(`PayPal Webhook: Activated subscription for user ${userId}`);
        }
      }
    }

    return NextResponse.json({ success: true, message: 'PayPal Webhook event received.' });
  } catch (error: any) {
    console.error("Error processing PayPal webhook:", error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
