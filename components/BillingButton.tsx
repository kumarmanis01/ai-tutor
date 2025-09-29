'use client';
import React from 'react';

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  prefill: { name: string; email: string };
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => { open: () => void };
  }
}

export default function BillingButton({ provider }: { provider: 'stripe' | 'razorpay' }) {
  async function subscribe() {
    if (provider === 'stripe') {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ plan: 'pro' }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } else {
      const res = await fetch('/api/billing/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 499, currency: 'INR' }),
      });
      const order = await res.json();

      const options: RazorpayOptions = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
        amount: order.amount,
        currency: order.currency,
        name: 'AI Tutor',
        description: 'Pro Subscription',
        order_id: order.id,
        handler: function (response: RazorpayResponse) {
          alert('Payment successful: ' + response.razorpay_payment_id);
        },
        prefill: { name: 'User', email: 'user@example.com' },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    }
  }

  return (
    <button
      onClick={subscribe}
      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
    >
      Subscribe ({provider})
    </button>
  );
}
