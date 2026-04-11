'use client';

/**
 * ParentUpgradeFlow
 *
 * Client component used on /parent/billing. Reuses PlanSelector,
 * PaymentMethodSelector and PaymentConfirmation from the student flow,
 * and adds child selection + family pricing + EMI option.
 *
 * FILE OBJECTIVE:
 * - Allow parent to pick child(ren), plan and payment method, then pay.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/parent-subscription.spec.ts
 *
 * EDIT LOG:
 * - 2026-04-08T00:00:00Z | copilot | created parent upgrade flow UI
 */

import React, { useCallback, useMemo, useState } from 'react';
import PlanSelector from '@/components/student/subscription/PlanSelector';
import PaymentMethodSelector from '@/components/student/subscription/PaymentMethodSelector';
import PaymentConfirmation from '@/components/student/subscription/PaymentConfirmation';
import type { PlanId } from '@/lib/subscription/plans';
import type { PaymentMethod } from '@/components/student/subscription/PaymentMethodSelector';
import { PLANS } from '@/lib/subscription/plans';

interface ChildInfo {
  studentId: string;
  name: string;
  grade: string;
  board: string;
}

interface ParentUpgradeFlowProps {
  childrenList: ChildInfo[];
}

type Step = 'select' | 'plan' | 'method' | 'confirm' | 'success' | 'failure';

export default function ParentUpgradeFlow({ childrenList }: ParentUpgradeFlowProps) {
  const [step, setStep] = useState<Step>('select');
  const [selectedChildren, setSelectedChildren] = useState<string[]>(childrenList.length ? [childrenList[0].studentId] : []);
  const [planId, setPlanId] = useState<PlanId>('monthly');
  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [isFamily, setIsFamily] = useState(false);
  const [emiMonths, setEmiMonths] = useState<number | undefined>(undefined);
  const [payLoading, setPayLoading] = useState(false);

  const toggleChild = useCallback((id: string) => {
    setSelectedChildren((cur) => {
      if (cur.includes(id)) return cur.filter((c) => c !== id);
      if (cur.length >= 3) return cur; // max 3
      return [...cur, id];
    });
  }, []);

  const totalRupees = useMemo(() => {
    const plan = PLANS[planId];
    if (isFamily && selectedChildren.length === 3) return Math.round(plan.billedRupees * 1.8 * 100) / 100;
    return Math.round(plan.billedRupees * selectedChildren.length * 100) / 100;
  }, [planId, selectedChildren.length, isFamily]);

  const openRazorpay = useCallback(async () => {
    setPayLoading(true);
    try {
      const orderRes = await fetch('/api/parent/subscription/order', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ planId, childIds: selectedChildren, isFamily, emiMonths }) });
      const orderJson = await orderRes.json().catch(() => ({}));
      if (!orderRes.ok || !orderJson?.orderId || !orderJson?.keyId) throw new Error(typeof orderJson?.error === 'string' ? orderJson.error : 'Could not create order');
      if (!window.Razorpay) throw new Error('Payment SDK not loaded -- please refresh and try again');

      const { orderId, amount, keyId } = orderJson as { orderId: string; amount: number; keyId: string };

      const options: any = {
        key: keyId,
        amount,
        currency: 'INR',
        name: 'Spinzy Academy',
        description: `${PLANS[planId].label} subscription`,
        order_id: orderId,
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const verifyRes = await fetch('/api/parent/subscription/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId: response.razorpay_order_id, paymentId: response.razorpay_payment_id, signature: response.razorpay_signature, planId }) });
            const verifyJson = await verifyRes.json().catch(() => ({}));
            if (!verifyRes.ok || !verifyJson?.success) throw new Error(typeof verifyJson?.error === 'string' ? verifyJson.error : 'Payment could not be confirmed');
            setStep('success');
          } catch (err) {
            setStep('failure');
          }
        },
      };

      const rz = new window.Razorpay(options);
      rz.open();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Payment failed. Please try again.';
      // eslint-disable-next-line no-console
      console.error('Payment error', msg);
      setStep('failure');
    } finally {
      setPayLoading(false);
    }
  }, [planId, selectedChildren, isFamily, emiMonths]);

  if (step === 'select') {
    return (
      <div className="space-y-4">
        <h2 className="text-base font-semibold">Select children</h2>
        <div className="space-y-2">
          {childrenList.map((c) => {
            const selected = selectedChildren.includes(c.studentId);
            return (
              <button key={c.studentId} type="button" onClick={() => toggleChild(c.studentId)} aria-pressed={selected} className={[
                'w-full text-left rounded-xl px-4 py-3 flex items-center justify-between gap-3 transition-colors',
                selected ? 'border-2 border-[#534AB7] bg-[#EEEDFE]' : 'border border-gray-200 bg-white hover:bg-gray-50',
              ].join(' ')}>
                <div>
                  <div className="text-sm font-medium">{c.name}</div>
                  <div className="text-xs text-gray-500">{[c.grade, c.board].filter(Boolean).join(' · ')}</div>
                </div>
                <div className="text-sm">{selected ? 'Selected' : 'Select'}</div>
              </button>
            );
          })}
        </div>

        <div className="flex gap-2">
          <button onClick={() => setStep('plan')} className="flex-1 min-h-[44px] rounded-xl bg-[#534AB7] text-white">Continue</button>
        </div>
      </div>
    );
  }

  if (step === 'plan') {
    return (
      <div className="space-y-4">
        <PlanSelector selected={planId} onSelect={(id) => setPlanId(id)} />
        <div className="flex items-center gap-3">
          <input id="family" type="checkbox" checked={isFamily} onChange={(e) => setIsFamily(e.target.checked)} disabled={selectedChildren.length !== 3} />
          <label htmlFor="family" className="text-sm text-gray-700">Use family pricing (3 children at 1.8×)</label>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setStep('method')} className="flex-1 min-h-[44px] rounded-xl bg-[#534AB7] text-white">Choose payment</button>
          <button onClick={() => setStep('select')} className="flex-1 min-h-[44px] rounded-xl border">Back</button>
        </div>
      </div>
    );
  }

  if (step === 'method') {
    return (
      <div className="space-y-4">
        <PaymentMethodSelector selected={method} onSelect={setMethod} />
        {planId === 'annual' && (
          <div>
            <label className="text-sm">EMI (optional)</label>
            <div className="flex gap-2 mt-2">
              {[3, 6, 12].map((m) => (
                <button key={m} type="button" onClick={() => setEmiMonths(m)} className={`px-3 py-2 rounded ${emiMonths === m ? 'bg-[#EAF3DE] border' : 'border'}`}>{m} months</button>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={() => setStep('confirm')} className="flex-1 min-h-[44px] rounded-xl bg-[#534AB7] text-white">Continue</button>
          <button onClick={() => setStep('plan')} className="flex-1 min-h-[44px] rounded-xl border">Back</button>
        </div>
      </div>
    );
  }

  if (step === 'confirm') {
    const emiSchedule = useMemo(() => {
      if (!emiMonths || planId !== 'annual') return null;
      const per = Math.round((totalRupees / emiMonths) * 100) / 100;
      const start = new Date();
      return Array.from({ length: emiMonths }).map((_, i) => {
        const d = new Date(start);
        d.setMonth(d.getMonth() + i);
        return { number: i + 1, due: d.toLocaleDateString('en-IN'), amount: per };
      });
    }, [emiMonths, totalRupees, planId]);

    return (
      <div>
        {emiSchedule && (
          <div className="rounded-xl border p-3 mb-4 bg-white">
            <h4 className="text-sm font-semibold">EMI schedule preview</h4>
            <div className="text-xs text-gray-600">Total ₹{totalRupees} over {emiMonths} months</div>
            <ul className="mt-2 space-y-1">
              {emiSchedule.map((s) => (
                <li key={s.number} className="flex justify-between text-sm">
                  <span>Installment {s.number} — {s.due}</span>
                  <span>₹{s.amount}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <PaymentConfirmation planId={planId} paymentMethod={method} loading={payLoading} onConfirm={openRazorpay} onBack={() => setStep('method')} />
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="rounded-2xl border border-[#1D9E75]/30 bg-[#EAF3DE] px-5 py-6 text-center">
        <h3 className="text-lg font-semibold">Payment confirmed</h3>
        <p className="mt-2 text-sm">Subscription applied to selected child(ren). Thank you!</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#E24B4A]/30 bg-[#FCEBEB] px-5 py-6 text-center">
      <h3 className="text-lg font-semibold">Payment failed</h3>
      <p className="mt-2 text-sm">We couldn't confirm the payment. Please try again or contact support.</p>
      <div className="mt-4"><button onClick={() => setStep('confirm')} className="px-4 py-2 rounded bg-[#534AB7] text-white">Retry</button></div>
    </div>
  );
}
