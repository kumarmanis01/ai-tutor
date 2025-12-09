'use client';

import { useState, useEffect } from 'react';
import { toast } from '@/lib/toast';
import { useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import Icon from '@/components/UI/AppIcon';
import useCurrentUser from '@/hooks/useCurrentUser';
import { useGlobalLoader } from '@/context/GlobalLoaderProvider';
import { logger } from '@/lib/logger';

interface FormData {
  phone: string;
  email?: string;
  otp: string;
  childClass: string;
  subjects: string[];
  name: string;
  board?: string;
  token?: string | null;
  preferredLanguage?: string | null;
}

const SignupFormWidget = () => {
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    phone: '',
    otp: '',
    childClass: '',
    subjects: [],
    name: '',
    board: undefined,
  });

  const { data: session } = useSession();
  const [signingWithGoogle, setSigningWithGoogle] = useState(false);

  // NOTE: OTP/widget flow removed — keep `widgetToken` state only if needed later.

  // When session becomes available (after Google / Email sign-in), auto-fill
  // available profile fields and move to step 3 to collect grade/board/language.
  useEffect(() => {
    if (!session?.user) return;
    setFormData((p) => ({
      ...p,
      name: p.name || (session.user?.name ?? ''),
      email: p.email || (session.user?.email ?? ''),
    }));
    // Advance to step 3 (collect class/board/subjects) using functional update
    setStep((s) => (s < 3 ? 3 : s));
  }, [session]);

  const subjects = [
    'Mathematics',
    'Science',
    'Social Studies',
    'English',
    'Hindi',
    'Physics',
    'Chemistry',
    'Biology',
  ];

  const handleSubjectToggle = (subject: string) => {
    setFormData((prev) => ({
      ...prev,
      subjects: prev.subjects.includes(subject)
        ? prev.subjects.filter((s) => s !== subject)
        : [...prev.subjects, subject],
    }));
  };

  const router = useRouter();
  const { mutate: mutateCurrentUser } = useCurrentUser();
  const { startLoading, stopLoading } = useGlobalLoader();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    startLoading('Saving profile...');
    try {
      const res = await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: formData.phone,
          email: formData.email ?? null,
          name: formData.name,
          class_grade: Number(formData.childClass) || null,
          board: formData.board,
          preferred_language: formData.preferredLanguage ?? null,
          subjects: formData.subjects,
          token: formData.token ?? null,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        toast(payload?.error || 'Failed to save profile');
        return;
      }
      // Refresh canonical client-side user cache and attempt a session refresh
      try {
        mutateCurrentUser?.();
      } catch {}
      try {
        await fetch('/api/user/refresh-session', { method: 'POST' });
      } catch {}
      router.push('/dashboard');
    } catch (err) {
      logger.error('onboarding submit error', { className: 'SignupFormEmailWidget', methodName: 'handleSubmit', error: String(err) });
      toast('Failed to complete signup');
    } finally {
      setSubmitting(false);
      stopLoading();
    }
  };

  return (
    <section
      id="signup-form-widget"
      className="py-16 md:py-24 bg-gradient-to-br from-primary/5 to-secondary/5"
    >
      <div className="mx-auto px-4 md:px-6 lg:px-8 max-w-2xl">
        <div className="text-center mb-8 md:mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-success/10 text-success rounded-full text-sm font-medium mb-4">
            <Icon name="RocketLaunchIcon" size={20} variant="solid" />
            <span>Start Your Free Trial</span>
          </div>
          <h2 className="font-headline font-bold text-3xl md:text-4xl lg:text-5xl text-secondary mb-4">
            Begin Your Learning Journey
          </h2>
          <p className="font-accent text-xl md:text-2xl text-primary mb-2">
            अपनी सीखने की यात्रा शुरू करें
          </p>
          <p className="font-body text-lg text-muted-foreground">
            No credit card required • 100% safe & private • Cancel anytime
          </p>
        </div>

        <div className="bg-background rounded-2xl border-2 border-border p-6 md:p-8 shadow-xl">
          <div className="flex items-center justify-between mb-8">
            <div
              className={`flex items-center gap-2 ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step >= 1 ? 'bg-primary text-white' : 'bg-muted'
                }`}
              >
                {step > 1 ? <Icon name="CheckIcon" size={20} variant="outline" /> : '1'}
              </div>
              <span className="font-body text-sm font-medium hidden sm:inline">Phone</span>
            </div>
            <div className="flex-1 h-0.5 bg-border mx-2" />
            <div
              className={`flex items-center gap-2 ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step >= 2 ? 'bg-primary text-white' : 'bg-muted'
                }`}
              >
                {step > 2 ? <Icon name="CheckIcon" size={20} variant="outline" /> : '2'}
              </div>
              <span className="font-body text-sm font-medium hidden sm:inline">Details</span>
            </div>
          </div>

          {step === 1 && (
            <div className="space-y-6">
                <div className="space-y-4 text-center">
                  <button
                    onClick={() => {
                      setSigningWithGoogle(true);
                      // redirect to home after Google sign-in; onboarding page removed
                      signIn('google', { callbackUrl: '/dashboard' });
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 bg-white text-gray-700 font-medium"
                  >
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                      <g>
                        <path d="M19.6 10.23c0-.68-.06-1.36-.18-2H10v3.79h5.41a4.63 4.63 0 01-2.01 3.04v2.52h3.24c1.9-1.75 2.96-4.33 2.96-7.35z" fill="#4285F4" />
                        <path d="M10 20c2.7 0 4.97-.89 6.63-2.41l-3.24-2.52c-.9.6-2.05.96-3.39.96-2.6 0-4.8-1.76-5.59-4.13H1.08v2.59A10 10 0 0010 20z" fill="#34A853" />
                        <path d="M4.41 12.9A5.99 5.99 0 014.07 10c0-.99.18-1.95.34-2.9V4.51H1.08A10 10 0 000 10c0 1.64.4 3.19 1.08 4.51l3.33-2.61z" fill="#FBBC05" />
                        <path d="M10 3.96c1.47 0 2.78.51 3.81 1.51l2.85-2.85C14.97.89 12.7 0 10 0A10 10 0 001.08 4.51l3.33 2.59C5.2 5.72 7.4 3.96 10 3.96z" fill="#EA4335" />
                      </g>
                    </svg>
                    Continue with Google
                  </button>
                  <div className="text-sm text-muted-foreground">or continue with phone verification</div>
                </div>
                {/* If user chose Google sign-in or session exists, show redirect/continue UI.
                    Otherwise render a simple phone input and allow proceeding to details. */}
                {!signingWithGoogle && !session ? (
                  <div className="space-y-4">
                    <div className="text-sm text-left">Enter your phone (optional) to help us personalize:</div>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="Phone (optional)"
                      className="w-full px-4 py-2 border rounded"
                    />
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => setStep(2)}
                        className="px-6 py-2 bg-primary text-white rounded-lg"
                      >
                        Continue
                      </button>
                      <div className="text-sm text-muted-foreground">or continue with Google</div>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    {session ? (
                      <>
                        Signed in as <strong>{session.user?.email || session.user?.name}</strong>. Continuing setup…
                      </>
                    ) : (
                      <>Redirecting to Google for sign-in…</>
                    )}
                  </div>
                )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 text-center">
              <div className="text-2xl font-semibold">🎉 Welcome to AI Tutor!</div>
              <div className="mt-4 text-sm text-muted-foreground">What should we call you?</div>
              <div className="mt-3">
                <input
                  type="text"
                  aria-label="Enter your name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter your name"
                  className="w-full px-4 py-3 bg-background border-2 border-border rounded-lg focus:border-primary focus:outline-none font-body text-base"
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">This helps us personalize your learning.</p>
              <div className="mt-4">
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => setStep(3)}
                    disabled={!formData.name?.trim()}
                    className="px-6 py-2 bg-primary text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue
                  </button>
                  <div className="text-sm text-muted-foreground">Phone: {formData.phone || 'not provided'}</div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="text-lg font-semibold">📚 Hey {formData.name || ''}, tell us about your studies</div>
              <div>
                <label className="block font-body font-medium text-sm text-foreground mb-2">Which class are you in?</label>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((num) => (
                    <button
                      key={num}
                      onClick={() => setFormData((p) => ({ ...p, childClass: num }))}
                      className={`px-3 py-2 rounded-lg border-2 ${formData.childClass === num ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background'}`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-body font-medium text-sm text-foreground mb-2">Which board?</label>
                <div className="space-y-2">
                  {['CBSE', 'ICSE', 'State Board', 'Other'].map((b) => (
                    <label key={b} className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="board"
                        checked={formData.board === b}
                        onChange={() => setFormData((p) => ({ ...p, board: b }))}
                      />
                      <span>{b}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-body font-medium text-sm text-foreground mb-2">Preferred language</label>
                <select
                  value={formData.preferredLanguage ?? ''}
                  onChange={(e) => setFormData((p) => ({ ...p, preferredLanguage: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="">Select language</option>
                  <option value="en">English</option>
                  <option value="hi">हिंदी</option>
                </select>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setStep(4)}
                  disabled={!formData.childClass || !formData.board}
                  className="px-4 py-2 bg-primary text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next Step
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="text-lg font-semibold">🎯 What subjects do you need help with?</div>
              <div className="text-sm text-muted-foreground">Select all that apply:</div>
              <div className="grid grid-cols-2 gap-3">
                {subjects.map((subject) => (
                  <button
                    key={subject}
                    onClick={() => handleSubjectToggle(subject)}
                    className={`px-4 py-2 rounded-lg border-2 transition-all font-body text-sm ${
                      formData.subjects.includes(subject)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-foreground hover:border-primary/30'
                    }`}
                  >
                    {formData.subjects.includes(subject) ? '☑️ ' : '☐ '} {subject}
                  </button>
                ))}
              </div>

              <div className="flex justify-end">
                  <button
                    onClick={() => {
                      if (!formData.name?.trim()) return toast('Name is required');
                      if (!formData.childClass) return toast('Please select a class');
                      // Prepare payload with phone and token
                      handleSubmit();
                    }}
                    disabled={submitting || !formData.childClass || !formData.name?.trim()}
                    className="px-6 py-2 bg-primary text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Saving...' : 'Start Learning!'}
                  </button>
              </div>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-border">
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Icon name="ShieldCheckIcon" size={16} variant="solid" className="text-success" />
                <span>Secure</span>
              </div>
              <div className="flex items-center gap-1">
                <Icon name="LockClosedIcon" size={16} variant="solid" className="text-success" />
                <span>Private</span>
              </div>
              <div className="flex items-center gap-1">
                <Icon name="CheckBadgeIcon" size={16} variant="solid" className="text-success" />
                <span>Verified</span>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          By signing up, you agree to our{' '}
          <a href="#" className="text-primary hover:underline">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="#" className="text-primary hover:underline">
            Privacy Policy
          </a>
        </p>
      </div>
    </section>
  );
};

export default SignupFormWidget;
