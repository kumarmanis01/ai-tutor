import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { SessionUser } from '@/lib/types';
import nodemailer from 'nodemailer';

async function sendPaymentSuccessEmail(
  to: string,
  name: string,
  plan: string,
  billingCycle: string,
  amount: number,
) {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: Number(process.env.EMAIL_SERVER_PORT),
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: 'Payment Successful - Spinzy Academy',
    html: `
      <h2>Thank you for your payment!</h2>
      <p>Hi ${name || to},</p>
      <p>Your payment for the <strong>${plan}</strong> plan (${billingCycle}) was successful.</p>
      <p>Amount: ₹${amount / 100}</p>
      <p>Your subscription is now active.</p>
      <br/>
      <p>Spinzy Academy Team</p>
    `,
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sessionUser = session.user as SessionUser;

  const body = await req.json();
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan, billingCycle, amount } =
    body;

  // Verify Razorpay signature
  const sign = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(razorpay_order_id + '|' + razorpay_payment_id)
    .digest('hex');

  if (sign !== razorpay_signature) {
    // Record failed payment
    await prisma.payment.create({
      data: {
        userId: sessionUser.id!,
        amount: amount,
        provider: 'razorpay',
        status: 'failed',
        createdAt: new Date(),
        transactionId: razorpay_payment_id,
        orderId: razorpay_order_id,
        plan: String(plan),
        billingCycle: String(billingCycle),
        meta: { signature: razorpay_signature },
      },
    });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Create Payment record (successful)
  const payment = await prisma.payment.create({
    data: {
      userId: sessionUser.id!,
      amount: amount,
      provider: 'razorpay',
      status: 'success',
      createdAt: new Date(),
      transactionId: razorpay_payment_id,
      orderId: razorpay_order_id,
      plan: String(plan),
      billingCycle: String(billingCycle),
      meta: { signature: razorpay_signature },
    },
  });

  // Calculate subscription dates
  const startDate = new Date();
  const endDate =
    billingCycle === 'annual'
      ? new Date(new Date().setFullYear(startDate.getFullYear() + 1))
      : new Date(new Date().setMonth(startDate.getMonth() + 1));

  // Deactivate any existing subscriptions for this user
  await prisma.subscription.updateMany({
    where: { userId: sessionUser.id!, active: true },
    data: { active: false },
  });

  // Create new active subscription and link to payment
  await prisma.subscription.create({
    data: {
      userId: sessionUser.id!,
      plan: String(plan),
      billingCycle: String(billingCycle),
      startDate,
      endDate,
      active: true,
      paymentId: payment.id, // Link to payment record
    },
  });

  // Send payment success email
  try {
    await sendPaymentSuccessEmail(
      sessionUser.email!,
      sessionUser.name || '',
      String(plan),
      String(billingCycle),
      amount,
    );
  } catch (err) {
    console.error('Failed to send payment email:', err);
  }

  return NextResponse.json({ success: true });
}
