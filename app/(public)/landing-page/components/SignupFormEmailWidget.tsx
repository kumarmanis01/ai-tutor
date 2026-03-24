'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import Icon from '@/components/UI/AppIcon';

type AuthMode = 'signup' | 'signin';

export default function SignupFormEmailWidget() {
  const [mode, setMode] = useState<AuthMode>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      router.push('/dashboard');
    }
  }, [status, session?.user, router]);

  if (status === 'loading' || (status === 'authenticated' && session?.user)) {
    return (
      <section id="signup-form-widget" className="py-16 md:py-24 bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="mx-auto px-4 max-w-2xl text-center text-muted-foreground">
          {status === 'authenticated' ? 'Taking you to your dashboard...' : 'Loading...'}
        </div>
      </section>
    );
  }

  const handleGoogle = () => {
    setLoading(true);
    signIn('google', { callbackUrl: '/dashboard' });
  };

  const handleFacebook = () => {
    setLoading(true);
    signIn('facebook', { callbackUrl: '/dashboard' });
  };

  const handleMagicLink = async (e: React.MouseEvent) => {
    e.preventDefault();
    setError('');
    if (!email?.trim()) {
      setError('Enter your email first.');
      return;
    }
    setLoading(true);
    const res = await signIn('email', { email: email.trim(), redirect: false, callbackUrl: '/dashboard' });
    if (res?.ok) {
      setEmailSent(true);
    } else {
      setError('Could not send magic link. Try again.');
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (mode === 'signup') {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      if (res.status === 409) {
        setError('Account already exists. Sign in or use magic link.');
        setMode('signin');
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError('Sign up failed. Try again.');
        setLoading(false);
        return;
      }
      const signInRes = await signIn('credentials', {
        email: email.trim(),
        password,
        redirect: false,
        callbackUrl: '/dashboard',
      });
      if (signInRes?.ok) {
        router.push('/dashboard');
        return;
      }
      setError('Account created. Please sign in.');
      setMode('signin');
      setLoading(false);
      return;
    }

    // Sign in
    if (password) {
      const res = await signIn('credentials', {
        email: email.trim(),
        password,
        redirect: false,
        callbackUrl: '/dashboard',
      });
      if (res?.ok) {
        router.push('/dashboard');
        return;
      }
      setError('Invalid email or password.');
      setLoading(false);
      return;
    }

    // Sign in with magic link
    const res = await signIn('email', { email: email.trim(), redirect: false, callbackUrl: '/dashboard' });
    if (res?.ok) setEmailSent(true);
    else setError('No account found or failed to send link.');
    setLoading(false);
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

        <div className="bg-background rounded-xl border border-border/80 p-5 md:p-6 shadow-sm max-w-md mx-auto">
          <h3 className="text-sm font-medium text-center text-muted-foreground mb-4">
            {mode === 'signup' ? 'Sign Up' : 'Sign In'}
          </h3>

          {emailSent ? (
            <p className="text-center text-sm text-muted-foreground py-2">
              Check your email -- we sent a link to <strong className="text-foreground">{email}</strong>.
            </p>
          ) : (
            <>
              {/* Socials side by side */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={loading}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 border border-border rounded-lg hover:bg-muted/40 text-foreground text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <path d="M19.6 10.23c0-.68-.06-1.36-.18-2H10v3.79h5.41a4.63 4.63 0 01-2.01 3.04v2.52h3.24c1.9-1.75 2.96-4.33 2.96-7.35z" fill="#4285F4" />
                    <path d="M10 20c2.7 0 4.97-.89 6.63-2.41l-3.24-2.52c-.9.6-2.05.96-3.39.96-2.6 0-4.8-1.76-5.59-4.13H1.08v2.59A10 10 0 0010 20z" fill="#34A853" />
                    <path d="M4.41 12.9A5.99 5.99 0 014.07 10c0-.99.18-1.95.34-2.9V4.51H1.08A10 10 0 000 10c0 1.64.4 3.19 1.08 4.51l3.33-2.61z" fill="#FBBC05" />
                    <path d="M10 3.96c1.47 0 2.78.51 3.81 1.51l2.85-2.85C14.97.89 12.7 0 10 0A10 10 0 001.08 4.51l3.33 2.59C5.2 5.72 7.4 3.96 10 3.96z" fill="#EA4335" />
                  </svg>
                  Google
                </button>
                <button
                  type="button"
                  onClick={handleFacebook}
                  disabled={loading}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 border border-border rounded-lg hover:bg-muted/40 text-foreground text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2" />
                  </svg>
                  Facebook
                </button>
              </div>

              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-2.5">
                {mode === 'signup' && (
                  <input
                    type="text"
                    required
                    placeholder="Full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-border rounded-lg placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                    autoComplete="name"
                  />
                )}
                <input
                  type="email"
                  required
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-lg placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                  autoComplete="email"
                />
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required={mode === 'signup'}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-border rounded-lg placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20 pr-14"
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {loading ? '...' : mode === 'signup' ? 'Sign Up' : 'Sign In'}
                </button>
              </form>

              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <button
                  type="button"
                  onClick={handleMagicLink}
                  disabled={loading || !email?.trim()}
                  className="text-primary hover:underline disabled:opacity-50"
                >
                  Magic link instead
                </button>
                <span>·</span>
                {mode === 'signup' ? (
                  <button type="button" onClick={() => { setMode('signin'); setError(''); setEmailSent(false); }} className="text-primary hover:underline">
                    Sign in
                  </button>
                ) : (
                  <button type="button" onClick={() => { setMode('signup'); setError(''); setEmailSent(false); }} className="text-primary hover:underline">
                    Sign up
                  </button>
                )}
              </div>

              {error && <p className="mt-2 text-xs text-destructive text-center">{error}</p>}
            </>
          )}

          <p className="mt-4 pt-3 border-t border-border/60 text-center text-[11px] text-muted-foreground">
            Secure · Private · Verified
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          By signing up, you agree to our{' '}
          <a href="#" className="text-primary hover:underline">Terms of Service</a>
          {' '}and{' '}
          <a href="#" className="text-primary hover:underline">Privacy Policy</a>
        </p>
      </div>
    </section>
  );
}
