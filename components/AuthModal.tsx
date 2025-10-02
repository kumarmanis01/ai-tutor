'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';

type Mode = 'signin' | 'signup';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
}

export default function AuthModal({ isOpen, onClose, message }: Props) {
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [grade, setGrade] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  // Handle Google sign in/up
  const handleGoogle = async () => {
    setLoading(true);
    await signIn('google', { callbackUrl: '/' });
    setLoading(false);
  };

  // Handle email sign in/up
  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (mode === 'signup') {
      // Call your custom signup API to create user with extra fields
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, parentEmail, profileImage, grade, password }),
      });
      if (res.status === 409) {
        setError('Account already exists. ');
        setMode('signin');
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError('Signup failed. Try again.');
        setLoading(false);
        return;
      }
      // After signup, send magic link for email verification/signin
      const signInRes = await signIn('email', { email, redirect: false, callbackUrl: '/' });
      if (signInRes?.ok) setEmailSent(true);
      else setError('Failed to send sign-in link.');
      setLoading(false);
      return;
    }

    // Sign in mode with password
    if (password) {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl: '/',
      });
      if (res?.ok) {
        window.location.href = '/';
        return;
      } else {
        setError('Invalid email or password.');
        setLoading(false);
        return;
      }
    }

    // Fallback: magic link sign in
    const res = await signIn('email', { email, redirect: false, callbackUrl: '/' });
    if (res?.ok) setEmailSent(true);
    else setError('No account found or failed to send sign-in link.');
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-sm p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
        <h2 className="text-lg font-semibold mb-2">{mode === 'signin' ? 'Sign In' : 'Sign Up'}</h2>
        {message && <p className="text-sm text-gray-600 mb-4">{message}</p>}
        <div className="space-y-3">
          {/* Google */}
          <button
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 bg-white text-gray-700 font-medium"
            disabled={loading}
          >
            <svg className="w-5 h-5" viewBox="0 0 48 48" fill="none">
              <g>
                <path
                  d="M44.5 20H24V28.5H36.9C36.1 32.1 32.7 35 28 35C22.5 35 18 30.5 18 25C18 19.5 22.5 15 28 15C30.4 15 32.6 15.9 34.3 17.3L39.1 12.5C36.2 10 32.3 8.5 28 8.5C17.8 8.5 9.5 16.8 9.5 27C9.5 37.2 17.8 45.5 28 45.5C38.2 45.5 46.5 37.2 46.5 27C46.5 25.7 46.4 24.4 46.2 23.1L44.5 20Z"
                  fill="#4285F4"
                />
                <path
                  d="M6.3 14.1L12.7 18.7C14.7 15.2 18.1 12.5 22 12.5C24.2 12.5 26.3 13.3 28 14.7L34.3 9.9C31.2 7.3 27.1 5.5 22.5 5.5C14.7 5.5 8 12.2 8 20C8 21.2 8.1 22.4 8.3 23.6L6.3 14.1Z"
                  fill="#34A853"
                />
                <path
                  d="M24 44.5C29.5 44.5 34.1 41.6 36.9 37.5L30.5 32.9C28.7 34.2 26.5 35 24 35C19.3 35 15.9 32.1 15.1 28.5H8.3C10.1 34.1 16.3 39.5 24 44.5Z"
                  fill="#FBBC05"
                />
                <path
                  d="M44.5 20H24V28.5H36.9C36.1 32.1 32.7 35 28 35C22.5 35 18 30.5 18 25C18 19.5 22.5 15 28 15C30.4 15 32.6 15.9 34.3 17.3L39.1 12.5C36.2 10 32.3 8.5 28 8.5C17.8 8.5 9.5 16.8 9.5 27C9.5 37.2 17.8 45.5 28 45.5C38.2 45.5 46.5 37.2 46.5 27C46.5 25.7 46.4 24.4 46.2 23.1L44.5 20Z"
                  fill="#EA4335"
                />
              </g>
            </svg>
            <span>{mode === 'signin' ? 'Sign in with Google' : 'Sign up with Google'}</span>
          </button>

          {/* Divider */}
          <div className="relative flex items-center my-3">
            <div className="flex-grow border-t border-gray-300"></div>
            <span className="mx-2 text-gray-400 text-xs">or</span>
            <div className="flex-grow border-t border-gray-300"></div>
          </div>

          {/* Email Form */}
          {emailSent ? (
            <div className="text-green-600 text-sm">Check your email for a sign-in link.</div>
          ) : (
            <form onSubmit={handleEmail} className="space-y-2">
              {/* Name */}
              <input
                type="text"
                required={mode === 'signup'}
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                autoComplete="name"
              />
              {/* Email */}
              <input
                type="email"
                required
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                autoComplete="email"
              />
              {/* Password */}
              <input
                type="password"
                required={mode === 'signup'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
              {/* Only show these fields on signup */}
              {mode === 'signup' && (
                <>
                  {/* Parent Email (optional) */}
                  <input
                    type="email"
                    placeholder="Parent's Email (optional)"
                    value={parentEmail}
                    onChange={(e) => setParentEmail(e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                    autoComplete="off"
                  />
                  {/* Grade */}
                  <input
                    type="text"
                    placeholder="Grade"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                    autoComplete="off"
                  />
                  {/* Profile Image URL */}
                  <input
                    type="url"
                    placeholder="Profile Image URL"
                    value={profileImage}
                    onChange={(e) => setProfileImage(e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                    autoComplete="off"
                  />
                </>
              )}

              <button
                type="submit"
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                disabled={loading}
              >
                {loading
                  ? 'Processing...'
                  : mode === 'signin'
                    ? 'Sign In with Email'
                    : 'Sign Up with Email'}
              </button>
              {error && <div className="text-red-600 text-xs">{error}</div>}
            </form>
          )}

          {/* Switch mode link */}
          <div className="text-center text-sm mt-2">
            {mode === 'signin' ? (
              <>
                Don&apos;t have an account?{' '}
                <button
                  className="text-blue-600 underline"
                  onClick={() => {
                    setMode('signup');
                    setError('');
                    setEmailSent(false);
                  }}
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  className="text-blue-600 underline"
                  onClick={() => {
                    setMode('signin');
                    setError('');
                    setEmailSent(false);
                  }}
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
