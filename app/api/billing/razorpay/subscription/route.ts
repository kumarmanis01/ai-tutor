import { NextResponse } from 'next/server';
import { razorpay } from '@/lib/payments';

/*
Purpose:
  Creates a Razorpay order for a payment (or, in commented code, a subscription).
How:
  Receives amount and currency in the request body.
  Calls Razorpay API to create an order.
  Returns the order object.
Error Handling:
  Returns a 500 error if Razorpay fails.
*/

export async function POST(req: Request) {
  try {
    const { amount, currency } = await req.json();

    const order = await razorpay.orders.create({
      amount: amount * 100, // convert to paise
      currency: currency || 'INR',
      receipt: `order_rcpt_${Date.now()}`,
    });

    return NextResponse.json(order);
  } catch (err) {
    console.error('Razorpay error:', err);
    return NextResponse.json({ error: 'razorpay_failed' }, { status: 500 });
  }
}
