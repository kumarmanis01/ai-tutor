'use client';

/**
 * PaymentConfirmation -- step 3 of upgrade flow.
 *
 * Shows order summary with GST breakdown and renewal date.
 * "Confirm & pay" button is LOCKED until user scrolls to the bottom
 * of the terms section. Uses IntersectionObserver on a sentinel div.
 * Never references referral programme.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { PLANS, renewalDateStr } from '@/lib/billing/plans';
import type { PlanId } from '@/lib/billing/plans';
import type { PaymentMethod } from './PaymentMethodSelector';

const TERMS_TEXT = `By confirming this payment, you agree to Spinzy's Terms of Service and Privacy Policy. Your subscription will automatically renew on the date shown above. You can cancel anytime from your account settings before the renewal date and you will not be charged for the next period. Payments are processed securely through Razorpay. Spinzy AI Tutor is provided by Spinzy Technologies Pvt. Ltd., registered in India. GST is levied at 18% on the base subscription price as per applicable Indian tax laws. For support, reach us at support@spinzy.in or through the in-app chat. This is a digital subscription; no physical goods are delivered. Refunds are processed as per our Refund Policy available at spinzy.in/refund-policy. By proceeding you confirm that you are 18 years or older, or have obtained parental consent if under 18.`;

const METHOD_LABEL: Record<PaymentMethod, string> = {
  upi: 'UPI (GPay / PhonePe / Paytm)',
  card: 'Debit / Credit Card',
  netbanking: 'Net Banking',
};

interface PaymentConfirmationProps {
  planId: PlanId;
  paymentMethod: PaymentMethod;
  loading: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

export function PaymentConfirmation({
  planId,
  paymentMethod,
  loading,
  onConfirm,
  onBack,
}: PaymentConfirmationProps) {
  const plan = PLANS[planId];
  const [termsUnlocked, setTermsUnlocked] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleSentinel = useCallback((entries: IntersectionObserverEntry[]) => {
    if (entries[0]?.isIntersecting) {
      setTermsUnlocked(true);
    }
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(handleSentinel, { threshold: 0.5 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleSentinel]);

  const canPay = termsUnlocked && !loading;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
        Order summary
      </h2>

      {/* Plan summary card */}
      <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {plan.label} plan
          </span>
          <span className="text-sm font-bold text-[#534AB7]">{plan.perMonthDisplay}</span>
        </div>

        {/* GST breakdown */}
        <div className="space-y-1 border-t border-gray-100 dark:border-slate-700 pt-3 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex justify-between">
            <span>Base price</span>
            <span>₹{plan.baseRupees.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>GST (18%)</span>
            <span>₹{plan.gstRupees.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold text-gray-900 dark:text-gray-100 border-t border-gray-100 dark:border-slate-700 pt-2 mt-2">
            <span>Total billed today</span>
            <span>₹{plan.billedRupees.toFixed(2)}</span>
          </div>
        </div>

        {/* Renewal date */}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Renews on <strong>{renewalDateStr(plan)}</strong> · Cancel anytime
        </p>

        {/* Payment method */}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Via {METHOD_LABEL[paymentMethod]}
        </p>
      </div>

      {/* Terms -- scrollable box; sentinel at bottom */}
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          Please read the terms below before confirming
        </p>
        <div
          className="h-28 overflow-y-auto rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 p-3 text-xs text-gray-600 dark:text-gray-400 leading-relaxed"
          role="region"
          aria-label="Subscription terms"
        >
          <p>{TERMS_TEXT}</p>
          {/* Sentinel div -- becomes visible only when user reaches bottom */}
          <div ref={sentinelRef} className="h-1 mt-2" aria-hidden />
        </div>
        {!termsUnlocked && (
          <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
            Scroll to the bottom of the terms to unlock payment
          </p>
        )}
      </div>

      {/* Actions */}
      <button
        type="button"
        onClick={onConfirm}
        disabled={!canPay}
        className={[
          'w-full min-h-[44px] rounded-xl text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#534AB7]',
          canPay
            ? 'bg-[#534AB7] text-white hover:bg-[#4338a3] active:bg-[#3730a3]'
            : 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500 cursor-not-allowed',
        ].join(' ')}
      >
        {loading ? 'Opening payment...' : `Confirm & pay ₹${plan.billedRupees.toFixed(2)}`}
      </button>

      <button
        type="button"
        onClick={onBack}
        disabled={loading}
        className="w-full min-h-[44px] rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#534AB7]"
      >
        Back
      </button>
    </div>
  );
}

export default PaymentConfirmation;
