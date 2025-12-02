'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/UI/AppIcon';
import OtpProviderForm from '@/components/Auth/OtpProviderForm';

interface FormData {
  phone: string;
  otp: string;
  childClass: string;
  subjects: string[];
  name: string;
  board?: string;
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

  const [widgetToken, setWidgetToken] = useState<string | null>(null);
  const [widgetError, setWidgetError] = useState<string | null>(null);

  useEffect(() => {
    // hydration not required for this component logic
    // Fetch widget token from server endpoint
    (async () => {
      try {
        const res = await fetch('/api/msg91/widget-token');
        const json = await res.json().catch(() => ({}));
        if (res.ok && json?.token) {
          setWidgetToken(String(json.token));
        } else {
          setWidgetError(json?.message || 'Widget token not available');
          console.warn('widget-token:', json);
        }
      } catch (e) {
        setWidgetError(String(e));
        console.warn('Error fetching widget token', e);
      }
    })();
  }, []);

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

  const handleSubmit = async () => {
    try {
      const res = await fetch('/api/user/onboarding-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          grade: formData.childClass,
          board: formData.board,
          subjects: formData.subjects,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        alert(payload?.error || 'Failed to save profile');
        return;
      }
      router.push('/student-home-dashboard');
    } catch (err) {
      console.error('onboarding submit error', err);
      alert('Failed to complete signup');
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
              <div>
                {/* <label className="block font-body font-medium text-sm text-foreground mb-2">
                  Mobile Number (मोबाइल नंबर)
                </label> */}
                {/* <div className="mb-3">
                  <input
                    value={formData.phone}
                    onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="Enter mobile number (widget will pre-fill this)"
                    className="w-full px-3 py-2 bg-background border-2 border-border rounded-lg focus:border-primary focus:outline-none"
                  />
                </div> */}
                <OtpProviderForm
                  widgetId="356b44674c70383033393134"
                  tokenAuth={widgetToken ?? '{token}'}
                  identifier={formData.phone}
                  autoVerify={false}
                  onSuccess={(result) => {
                    // result may be the structured { raw, token, phone } we now return
                    console.info('[SignupFormWidget] otp onSuccess', result);
                    const phone = result?.phone ?? (result?.raw && (result?.raw?.identifier || result?.raw?.mobile || result?.raw?.phone));
                    const token = result?.token ?? (typeof result === 'string' ? result : undefined);
                    if (phone) {
                      setFormData((p) => ({ ...p, phone }));
                    }
                    // If token exists and autoVerify is false, we can call verify here and log response
                    if (token) {
                      (async () => {
                        try {
                          console.info('[SignupFormWidget] verifying token from widget', { tokenSnippet: String(token).slice(-8) });
                          const r = await fetch('/api/msg91/verify-access-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessToken: token }) });
                          const j = await r.json().catch(() => ({}));
                          console.info('[SignupFormWidget] verify response', { status: r.status, ok: r.ok, body: j });
                        } catch (e) {
                          console.warn('[SignupFormWidget] verify call failed', e);
                        }
                      })();
                    }

                    setStep(2);
                  }}
                  onFailure={(err) => {
                    console.warn('[SignupFormWidget] otp widget failure', err);
                    alert('OTP widget failed: ' + String(err));
                  }}
                />
                {widgetError ? (
                  console.warn('Widget error:', widgetError)
                  // <p className="mt-2 text-xs text-rose-500">Widget token unavailable: {widgetError}</p>
                ) : (
                  console.info('Found token Widget token:', widgetToken)
                  // <p className="mt-2 text-xs text-muted-foreground">
                  //   Use the widget above to receive an OTP and continue the signup flow.
                  // </p>
                )}
              </div>
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
                <button
                  onClick={() => setStep(3)}
                  disabled={!formData.name?.trim()}
                  className="px-6 py-2 bg-primary text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue
                </button>
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
                    if (!formData.name?.trim()) return alert('Name is required');
                    if (!formData.childClass) return alert('Please select a class');
                    handleSubmit();
                  }}
                  disabled={!formData.childClass || !formData.name?.trim()}
                  className="px-6 py-2 bg-primary text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Start Learning!
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
