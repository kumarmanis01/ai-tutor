/**
 * FILE OBJECTIVE:
 * - Newsletter signup form: email input + DPDP consent checkbox, POSTs to
 *   /api/v1/newsletter/subscribe. Shows success/error states.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/NewsletterSignup.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T00:00:00Z | copilot | created for v3 landing page
 */
'use client';

import { useState, FormEvent } from 'react';
import Icon from '@/components/UI/AppIcon';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

const NewsletterSignup = () => {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<FormState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!consent) {
      setErrorMsg('Please tick the consent box to continue.');
      return;
    }
    setState('submitting');
    setErrorMsg('');

    try {
      const res = await fetch('/api/v1/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, consentGiven: consent }),
      });

      if (res.ok) {
        setState('success');
      } else {
        const data: unknown = await res.json();
        const message =
          data !== null &&
          typeof data === 'object' &&
          'message' in data &&
          typeof (data as { message: unknown }).message === 'string'
            ? (data as { message: string }).message
            : 'Something went wrong. Please try again.';
        setErrorMsg(message);
        setState('error');
      }
    } catch {
      setErrorMsg('Could not connect. Please check your connection and try again.');
      setState('error');
    }
  };

  if (state === 'success') {
    return (
      <section className="py-10 md:py-12 bg-[#EAF3DE]">
        <div className="mx-auto px-4 max-w-lg text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[#1D9E75] rounded-full mb-4">
            <Icon name="CheckCircleIcon" size={28} variant="solid" className="text-white" />
          </div>
          <h3 className="font-headline font-bold text-2xl text-secondary mb-2">
            You&apos;re on the list!
          </h3>
          <p className="font-body text-base text-muted-foreground">
            We&apos;ll send you exam tips, learning strategies, and Spinzy updates. No spam.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-10 md:py-12 bg-[#EEEDFE]/60">
      <div className="mx-auto px-4 md:px-6 lg:px-8 max-w-xl">
        <div className="text-center mb-6">
          <h2 className="font-headline font-bold text-2xl md:text-3xl text-secondary mb-2">
            Get Free Exam Tips Every Week
          </h2>
          <p className="font-body text-base text-muted-foreground">
            Board exam strategies, learning hacks, and Spinzy updates -- delivered to your inbox.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="newsletter-email" className="sr-only">
              Email address
            </label>
            <input
              id="newsletter-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email address"
              className="w-full px-4 py-3 rounded-lg border border-border bg-white text-secondary placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#534AB7] min-h-[48px] text-base"
            />
          </div>

          {/* DPDP consent */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked);
                if (e.target.checked) setErrorMsg('');
              }}
              className="mt-0.5 w-4 h-4 rounded border-border text-[#534AB7] focus:ring-[#534AB7] shrink-0"
            />
            <span className="font-body text-sm text-muted-foreground leading-relaxed">
              I agree to receive emails from Spinzy Academy and accept the{' '}
              <a href="/privacy" className="text-[#534AB7] hover:underline">
                Privacy Policy
              </a>
              . You can unsubscribe at any time.
            </span>
          </label>

          {errorMsg && (
            <p role="alert" className="text-sm text-[#E24B4A] font-medium">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={state === 'submitting'}
            className="w-full py-3 rounded-lg bg-[#534AB7] text-white font-semibold hover:bg-[#433ba0] transition-all min-h-[48px] disabled:opacity-60 disabled:cursor-not-allowed text-base"
          >
            {state === 'submitting' ? 'Subscribing...' : 'Subscribe -- it\u2019s free'}
          </button>
        </form>
      </div>
    </section>
  );
};

export default NewsletterSignup;
