import { NextRequest, NextResponse } from 'next/server';
import { queryDb } from '@/lib/mysql';

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
    const errorDetail = data.error_description || data.error || 'Client Authentication failed';
    const modeName = isSandbox ? 'Sandbox' : 'Live';
    throw new Error(`PayPal Authentication failed (${errorDetail}). Please check your PayPal Client ID, Secret, and Mode (${modeName}) in Admin Settings > Gateway.`);
  }

  return { accessToken: data.access_token, baseUrl };
}

export async function POST(req: NextRequest) {
  try {
    const { amount, currency = 'USD', planName = 'Screenplay Pro Plan', userId, planId } = await req.json();

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid payment amount provided.' }, { status: 400 });
    }

    // Read PayPal configuration from MySQL app_settings
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

    if (!paypalClientId || !paypalClientSecret) {
      return NextResponse.json({
        success: false,
        error: 'PayPal is not configured in Admin Settings. Please enter PayPal Client ID & Secret in Admin Panel.'
      }, { status: 400 });
    }

    const isSandbox = paypalMode !== 'live';
    const { accessToken, baseUrl } = await getPayPalAccessToken(paypalClientId, paypalClientSecret, isSandbox);

    const formattedAmount = amount.toFixed(2);
    const customId = userId && planId ? `${userId}:${planId}` : (userId || planId || undefined);

    const orderRes = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            custom_id: customId,
            description: planName,
            amount: {
              currency_code: currency,
              value: formattedAmount,
            },
          },
        ],
      }),
    });

    const orderData = await orderRes.json();
    if (!orderRes.ok || !orderData.id) {
      throw new Error(orderData.message || 'Failed to create PayPal order.');
    }

    const approveLink = orderData.links?.find((l: any) => l.rel === 'approve')?.href;

    return NextResponse.json({
      success: true,
      orderId: orderData.id,
      approveUrl: approveLink,
      clientId: paypalClientId,
      mode: paypalMode,
    });
  } catch (error: any) {
    console.error("Error creating PayPal order:", error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to create PayPal order' }, { status: 500 });
  }
}
