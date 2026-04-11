'use client';

import React, { useState } from 'react';

export default function AddCard({ email, phone }: { email?: string; phone?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    setError(null);
    setLoading(true);
    try {
      // Ensure customer exists
      const custRes = await fetch('/api/payments/customer', { method: 'POST' });
      if (!custRes.ok) throw new Error('could-not-create-customer');
      const custJson = await custRes.json();
      // Create a small checkout session (1 INR default)
      const sessionRes = await fetch('/api/payments/checkout/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ amountPaise: 100 }) });
      if (!sessionRes.ok) throw new Error('could-not-create-session');
      const sessionJson = await sessionRes.json();

      const key = sessionJson.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      const orderId = sessionJson.orderId;
      if (!key || !orderId) throw new Error('invalid-session');

      const options: any = {
        key,
        order_id: orderId,
        name: 'Spinzy Academy',
        description: 'Save payment method',
        prefill: { email: email ?? custJson.email ?? '', contact: phone ?? custJson.phone ?? '' },
        handler: async function (resp: any) {
          try {
            // Save payment method server-side using the payment id returned by Checkout
            const saveRes = await fetch('/api/payments/methods', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ providerPaymentMethodId: resp.razorpay_payment_id, customerId: custJson.customerId, meta: resp }) });
            if (!saveRes.ok) throw new Error('save-failed');
            const saveJson = await saveRes.json();
            // Trigger verification which will fetch the payment details and mark verified
            await fetch('/api/payments/methods/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ providerPaymentMethodId: resp.razorpay_payment_id }) });
            setLoading(false);
          } catch (err) {
            setError(String(err));
            setLoading(false);
          }
        },
        modal: { ondismiss: () => setLoading(false) },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Razorpay: any = (window as any).Razorpay;
      if (!Razorpay) throw new Error('razorpay-sdk-missing');
      const rzp = new Razorpay(options);
      rzp.open();
    } catch (err: any) {
      setError(err?.message || String(err));
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={handleAdd} disabled={loading} className="px-3 py-2 rounded bg-[#534AB7] text-white">
        {loading ? 'Opening...' : 'Add card / Save payment method'}
      </button>
      {error && <div className="text-sm text-red-600 mt-2">{error}</div>}
    </div>
  );
}
