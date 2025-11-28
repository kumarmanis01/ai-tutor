'use client';

import { useState, useEffect } from 'react';
import Icon from '@/components/UI/AppIcon';

interface FormData {
  phone: string;
  otp: string;
  childClass: string;
  subjects: string[];
}

const SignupForm = () => {
  const [isHydrated, setIsHydrated] = useState(false);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    phone: '',
    otp: '',
    childClass: '',
    subjects: [],
  });
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated || countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isHydrated, countdown]);

  const classes = [
    'Class 1',
    'Class 2',
    'Class 3',
    'Class 4',
    'Class 5',
    'Class 6',
    'Class 7',
    'Class 8',
    'Class 9',
    'Class 10',
    'Class 11',
    'Class 12',
  ];

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

  const handleSendOTP = () => {
    if (formData.phone.length === 10) {
      setOtpSent(true);
      setCountdown(30);
    }
  };

  const handleVerifyOTP = () => {
    if (formData.otp === '123456') {
      setStep(2);
    }
  };

  const handleSubjectToggle = (subject: string) => {
    setFormData((prev) => ({
      ...prev,
      subjects: prev.subjects.includes(subject)
        ? prev.subjects.filter((s) => s !== subject)
        : [...prev.subjects, subject],
    }));
  };

  const handleSubmit = () => {
    console.log('Form submitted:', formData);
  };

  return (
    <section
      id="signup-form"
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
                <label className="block font-body font-medium text-sm text-foreground mb-2">
                  Mobile Number (मोबाइल नंबर)
                </label>
                <div className="flex gap-2">
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg border border-border">
                    <Icon name="DevicePhoneMobileIcon" size={20} variant="outline" />
                    <span className="font-body text-sm">+91</span>
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })
                    }
                    placeholder="Enter 10-digit mobile number"
                    className="flex-1 px-4 py-2 bg-background border-2 border-border rounded-lg focus:border-primary focus:outline-none font-body text-base"
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  We'll send a 6-digit OTP to verify your number
                </p>
              </div>

              {otpSent && (
                <div>
                  <label className="block font-body font-medium text-sm text-foreground mb-2">
                    Enter OTP (OTP दर्ज करें)
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={formData.otp}
                    onChange={(e) =>
                      setFormData({ ...formData, otp: e.target.value.replace(/\D/g, '') })
                    }
                    placeholder="Enter 6-digit OTP"
                    className="w-full px-4 py-2 bg-background border-2 border-border rounded-lg focus:border-primary focus:outline-none font-body text-base"
                  />
                  <p className="mt-2 text-xs text-success">
                    Mock OTP for testing: <span className="font-bold">123456</span>
                  </p>
                  {isHydrated && countdown > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Resend OTP in {countdown} seconds
                    </p>
                  )}
                </div>
              )}

              {!otpSent ? (
                <button
                  onClick={handleSendOTP}
                  disabled={formData.phone.length !== 10}
                  className="w-full py-3 bg-primary text-white rounded-lg font-cta font-semibold hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send OTP
                </button>
              ) : (
                <button
                  onClick={handleVerifyOTP}
                  disabled={formData.otp.length !== 6}
                  className="w-full py-3 bg-primary text-white rounded-lg font-cta font-semibold hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Verify & Continue
                </button>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block font-body font-medium text-sm text-foreground mb-2">
                  Child's Class (बच्चे की कक्षा)
                </label>
                <select
                  value={formData.childClass}
                  onChange={(e) => setFormData({ ...formData, childClass: e.target.value })}
                  className="w-full px-4 py-2 bg-background border-2 border-border rounded-lg focus:border-primary focus:outline-none font-body text-base"
                >
                  <option value="">Select Class</option>
                  {classes.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-body font-medium text-sm text-foreground mb-3">
                  Subjects Needed (आवश्यक विषय)
                </label>
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
                      {subject}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={!formData.childClass || formData.subjects.length === 0}
                className="w-full py-3 bg-primary text-white rounded-lg font-cta font-semibold hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <span>Start Free Learning</span>
                <Icon name="ArrowRightIcon" size={20} variant="outline" />
              </button>
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

export default SignupForm;
