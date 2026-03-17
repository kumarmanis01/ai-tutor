'use client';

import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/UI/AppIcon';

const OtpSignupForm = () => {
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }
    setError('');
    window.location.href = `/auth/signup?phone=${encodeURIComponent(digits)}`;
  };

  return (
    <section id="signup-form-widget" className="py-12 md:py-16 bg-[#EEEDFE]/50">
      <div className="mx-auto px-4 md:px-6 lg:px-8 max-w-lg">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-border p-6 md:p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-[#534AB7] rounded-xl flex items-center justify-center mx-auto mb-3">
              <Icon name="SparklesIcon" size={28} variant="solid" className="text-white" />
            </div>
            <h2 className="font-headline font-bold text-2xl text-secondary">
              Start free with Teacher Vidya
            </h2>
            <p className="font-accent text-base text-[#534AB7] mt-1">Teacher Vidya के साथ मुफ्त शुरू करें</p>
            <p className="font-body text-sm text-muted-foreground mt-2">
              3 free sessions per subject · No credit card · Class 6–12
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="lp-phone" className="block text-sm font-medium text-foreground mb-1">
                Mobile number
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-border bg-muted text-foreground text-sm font-medium">
                  +91
                </span>
                <input
                  id="lp-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                    setError('');
                  }}
                  className="flex-1 min-h-[44px] px-3 py-2 rounded-r-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#534AB7] text-base"
                />
              </div>
              {error && (
                <p className="mt-1 text-sm text-[#E24B4A]">{error}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full min-h-[44px] py-3 bg-[#534AB7] hover:bg-[#4239a0] text-white font-cta font-semibold rounded-lg transition-colors text-base flex items-center justify-center gap-2"
            >
              <Icon name="ArrowRightIcon" size={20} variant="outline" />
              Continue — Get OTP
            </button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-xs text-muted-foreground">
              Already have an account?{' '}
              <Link href="/auth/signin" className="text-[#534AB7] hover:underline font-medium">
                Log in
              </Link>
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-border">
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Icon name="ShieldCheckIcon" size={14} variant="solid" className="text-[#1D9E75]" />
                Safe & private
              </span>
              <span className="flex items-center gap-1">
                <Icon name="CheckCircleIcon" size={14} variant="solid" className="text-[#1D9E75]" />
                No spam
              </span>
              <span className="flex items-center gap-1">
                <Icon name="XCircleIcon" size={14} variant="solid" className="text-[#1D9E75]" />
                Cancel anytime
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default OtpSignupForm;
