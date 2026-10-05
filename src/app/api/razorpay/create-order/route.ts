import { type NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { nanoid } from 'nanoid';
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { amount, currency = 'INR' } = await req.json();

    if (!amount || typeof amount !== 'number' || amount < 100) {
      return NextResponse.json({ success: false, error: 'Invalid amount provided.' }, { status: 400 });
    }

    // Read keys from Firestore Admin Settings first, with .env fallback
    let razorpayKeyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
    let razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || '';

    try {
      const docSnap = await adminDb.collection('webSettings').doc('applicationConfig').get();
      if (docSnap.exists) {
        const data = docSnap.data();
        if (data?.razorpayKeyId?.trim()) {
          razorpayKeyId = data.razorpayKeyId.trim();
        }
        if (data?.razorpayKeySecret?.trim()) {
          razorpayKeySecret = data.razorpayKeySecret.trim();
        }
      }
    } catch (dbErr) {
      console.warn("Could not load payment settings from Firestore, using .env fallback:", dbErr);
    }

    if (!razorpayKeyId || !razorpayKeySecret) {
      console.error("Razorpay API keys are not configured in Admin Settings or .env");
      return NextResponse.json({ success: false, error: 'Payment gateway not configured on server.' }, { status: 500 });
    }

    const instance = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    });

    const options = {
      amount: amount,
      currency: currency,
      receipt: `receipt_${nanoid()}`,
    };

    const order = await instance.orders.create(options);

    if (!order) {
      return NextResponse.json({ success: false, error: 'Failed to create order with Razorpay.' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, keyId: razorpayKeyId, ...order });

  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ success: false, error: `Internal Server Error: ${errorMessage}` }, { status: 500 });
  }
}
