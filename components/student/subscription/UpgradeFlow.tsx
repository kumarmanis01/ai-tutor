'use client';

/**
 * UpgradeFlow -- FreemiumUpgradeGate → PlanSelector → PaymentMethodSelector
 *               → PaymentConfirmation → Razorpay → Success | Failure
 *
 * Steps:
 *   'gate'     -- headline + "See plans" + "Remind me later"
 *   'plan'     -- PlanSelector
 *   'method'   -- PaymentMethodSelector
 *   'confirm'  -- PaymentConfirmation (locked until terms scrolled)
 *   'success'  -- thank-you + redirect to /dashboard
 *   'failure'  -- error + retry (max 3x) + support contact
 *
 * Never mentions referral programme.
 * Razorpay SDK loaded globally via app/providers.tsx -- no re-load here.
 */

import React, { useState, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { UPGRADE_FLOW_SUPPORT_EMAIL } from '@/lib/email/functionalityEmails';
import PlanSelector from './PlanSelector';
import PaymentMethodSelector from './PaymentMethodSelector';
import PaymentConfirmation from './PaymentConfirmation';
import AddCard from './AddCard';
import SavedPaymentMethods from './SavedPaymentMethods';
import type { PlanId } from '@/lib/billing/plans';
import type { PaymentMethod } from './PaymentMethodSelector';

type Step = 'gate' | 'plan' | 'method' | 'confirm' | 'success' | 'failure';

const MAX_RETRIES = 3;

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay?: any;
  }
}

interface UpgradeFlowProps {
  studentName?: string | null;
  studentEmail?: string | null;
  freeTierUsage?: {
    sessionsUsed: number;
    sessionsRemaining: number;
    periodStart: string; // ISO string from server
  } | null;
}

export function UpgradeFlow({ studentName, studentEmail, freeTierUsage }: UpgradeFlowProps) {
  const [step, setStep] = useState<Step>('gate');
  const [planId, setPlanId] = useState<PlanId>('standard_monthly');
  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [payLoading, setPayLoading] = useState(false);
  const [failureMsg, setFailureMsg] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  const handleDismiss = useCallback(async () => {
    try {
      await fetch('/api/student/subscription/dismiss', { method: 'POST' });
    } catch (err) {
      logger.warn('handleDismiss failed', { component: 'UpgradeFlow', methodName: 'handleDismiss', error: String(err) });
      // non-blocking -- dismiss is UX-only
    }
    // Reload so dashboard shows banner instead of gate
    window.location.reload();
  }, []);

  const openRazorpay = useCallback(async () => {
    setPayLoading(true);
    setFailureMsg('');

    try {
      const orderRes = await fetch('/api/student/subscription/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      const orderJson = await orderRes.json().catch(() => ({}));
      if (!orderRes.ok || !orderJson?.orderId || !orderJson?.keyId) {
        throw new Error(typeof orderJson?.error === 'string' ? orderJson.error : 'Could not create order');
      }

      if (!window.Razorpay) {
        throw new Error('Payment SDK not loaded -- please refresh and try again');
      }

      const { orderId, amount, keyId } = orderJson as {
        orderId: string;
        amount: number;
        keyId: string;
      };

      const options = {
        key: keyId,
        amount,
        currency: 'INR',
        name: 'Spinzy Academy',
        description: 'Monthly subscription',
        image: 'https://spinzy.in/logos/logo-razorpay.png',
        order_id: orderId,
        prefill: { name: studentName ?? '', email: studentEmail ?? '' },
        theme: { color: '#F97316' },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const verifyRes = await fetch('/api/student/subscription/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                planId,
              }),
            });
            const verifyJson = await verifyRes.json().catch(() => ({}));
            if (!verifyRes.ok || !verifyJson?.success) {
              throw new Error('Verification failed -- please contact support if you were charged');
            }
            setStep('success');
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Payment could not be confirmed';
            setFailureMsg(msg);
            setStep('failure');
          } finally {
            setPayLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setPayLoading(false);
            // User closed modal without paying -- stay on confirm step
          },
        },
      };

      const rz = new window.Razorpay(options);
      rz.open();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Payment failed. Please try again.';
      setFailureMsg(msg);
      setStep('failure');
      setPayLoading(false);
    }
  }, [planId, studentName, studentEmail]);

  const handleRetry = useCallback(() => {
    if (retryCount >= MAX_RETRIES) return;
    setRetryCount((c) => c + 1);
    setStep('confirm');
  }, [retryCount]);

  // ── Step: gate ──────────────────────────────────────────────────────────────
  if (step === 'gate') {
    return (
      <section
        aria-labelledby="upgrade-gate-heading"
        className="rounded-2xl border border-[#534AB7]/30 bg-[#EEEDFE] dark:bg-[#534AB7]/10 px-5 py-6"
      >
        <h2
          id="upgrade-gate-heading"
          className="mb-2 text-lg font-bold text-gray-900 dark:text-gray-100"
        >
          You&apos;ve used all your free sessions
        </h2>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
          Keep learning with Teacher Vidya -- unlimited AI tutor sessions, personalised to you.
        </p>

        {/* Usage counter grid */}
        {freeTierUsage && (() => {
          const resetDate = new Date(freeTierUsage.periodStart);
          resetDate.setMonth(resetDate.getMonth() + 1);
          const resetLabel = resetDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
          return (
            <div className="mb-4 grid grid-cols-3 divide-x divide-[#534AB7]/15 rounded-xl bg-white dark:bg-slate-800/50 border border-[#534AB7]/20 overflow-hidden">
              <div className="py-3 text-center">
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{freeTierUsage.sessionsUsed}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">used</p>
              </div>
              <div className="py-3 text-center">
                <p className="text-xl font-bold text-[#E24B4A]">{freeTierUsage.sessionsRemaining}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">left</p>
              </div>
              <div className="py-3 text-center">
                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{resetLabel}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">resets</p>
              </div>
            </div>
          );
        })()}

        <p className="mb-5 text-xl font-bold text-[#534AB7]">₹99/month</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => setStep('plan')}
            className="flex-1 min-h-[44px] rounded-xl bg-[#534AB7] text-sm font-semibold text-white hover:bg-[#4338a3] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#534AB7]"
          >
            See plans
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="flex-1 min-h-[44px] rounded-xl border border-[#534AB7]/40 bg-white dark:bg-transparent text-sm font-medium text-[#534AB7] hover:bg-[#EEEDFE] dark:hover:bg-[#534AB7]/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#534AB7]"
          >
            Remind me later
          </button>
        </div>
      </section>
    );
  }

  // ── Step: plan ──────────────────────────────────────────────────────────────
  if (step === 'plan') {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-6 space-y-5">
        <PlanSelector selected={planId} onSelect={setPlanId} />
        <button
          type="button"
          onClick={() => setStep('method')}
          className="w-full min-h-[44px] rounded-xl bg-[#534AB7] text-sm font-semibold text-white hover:bg-[#4338a3] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#534AB7]"
        >
          Continue
        </button>
        <button
          type="button"
          onClick={() => setStep('gate')}
          className="w-full min-h-[44px] rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        >
          Back
        </button>
      </div>
    );
  }

  // ── Step: method ────────────────────────────────────────────────────────────
  if (step === 'method') {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-6 space-y-5">
        <PaymentMethodSelector selected={method} onSelect={setMethod} />
        {/* When user chooses card, surface saved methods and AddCard flow */}
        {method === 'card' && (
          <div className="pt-3">
            <SavedPaymentMethods />
            <div className="mt-3">
              <AddCard email={studentEmail ?? undefined} />
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setStep('confirm')}
          className="w-full min-h-[44px] rounded-xl bg-[#534AB7] text-sm font-semibold text-white hover:bg-[#4338a3] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#534AB7]"
        >
          Continue
        </button>
        <button
          type="button"
          onClick={() => setStep('plan')}
          className="w-full min-h-[44px] rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        >
          Back
        </button>
      </div>
    );
  }

  // ── Step: confirm ───────────────────────────────────────────────────────────
  if (step === 'confirm') {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-6">
        <PaymentConfirmation
          planId={planId}
          paymentMethod={method}
          loading={payLoading}
          onConfirm={openRazorpay}
          onBack={() => setStep('method')}
        />
      </div>
    );
  }

  // ── Step: success ───────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <section
        aria-labelledby="upgrade-success-heading"
        className="rounded-2xl border border-[#1D9E75]/30 bg-[#EAF3DE] dark:bg-[#1D9E75]/10 px-5 py-6 text-center"
      >
        <p className="text-3xl mb-3" aria-hidden>🎉</p>
        <h2
          id="upgrade-success-heading"
          className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2"
        >
          You&apos;re all set!
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">
          Your subscription is active. Keep learning -- Teacher Vidya is ready for you.
        </p>
        <a
          href="/dashboard"
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#1D9E75] px-6 text-sm font-semibold text-white hover:bg-[#178a65] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1D9E75]"
        >
          Go to dashboard
        </a>
      </section>
    );
  }

  // ── Step: failure ───────────────────────────────────────────────────────────
  return (
    <section
      aria-labelledby="upgrade-failure-heading"
      className="rounded-2xl border border-[#E24B4A]/30 bg-[#FCEBEB] dark:bg-[#E24B4A]/10 px-5 py-6"
    >
      <h2
        id="upgrade-failure-heading"
        className="text-base font-bold text-gray-900 dark:text-gray-100 mb-2"
      >
        Payment unsuccessful
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
        {failureMsg || 'Something went wrong. Please try again.'}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        If you were charged, please contact us at support@spinzy.in
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        {retryCount < MAX_RETRIES && (
          <button
            type="button"
            onClick={handleRetry}
            className="flex-1 min-h-[44px] rounded-xl bg-[#534AB7] text-sm font-semibold text-white hover:bg-[#4338a3] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#534AB7]"
          >
            Try again ({MAX_RETRIES - retryCount} left)
          </button>
        )}
        <a
          href={`mailto:${UPGRADE_FLOW_SUPPORT_EMAIL}`}
          className="flex-1 min-h-[44px] inline-flex items-center justify-center rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        >
          Contact support
        </a>
      </div>
    </section>
  );
}

export default UpgradeFlow;
