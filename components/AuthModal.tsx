'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';

type Mode = 'signin' | 'signup';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
}

export default function AuthModal({ isOpen, onClose }: Props) {
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // const [parentEmail, setParentEmail] = useState('');
  // const [grade, setGrade] = useState('');
  // const [country, setCountry] = useState(''); // <-- Add country
  // const [profileImage, setProfileImage] = useState('');
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // State to toggle password visibility

  if (!isOpen) return null;

  // Handle Google sign in/up
  const handleGoogle = async () => {
    setLoading(true);
    await signIn('google', { callbackUrl: '/' });
    setLoading(false);
  };

  // Handle Facebook sign in/up
  const handleFacebook = async () => {
    setLoading(true);
    await signIn('facebook', { callbackUrl: '/' });
    setLoading(false);
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (mode === 'signup') {
      // Call your custom signup API to create user with extra fields
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }), //parentEmail, profileImage, grade, country
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
        <h2
          className="text-lg font-semibold text-center mb-2"
          style={{
            color: '#0a3180', // Differentiated color
            letterSpacing: '0.5px',
            fontFamily: 'Montserrat, Arial, sans-serif',
            fontWeight: 700,
          }}
        >
          {mode === 'signin' ? 'Sign In' : 'Sign Up'}
        </h2>
        {/* {message && <p className="text-sm text-gray-600 mb-4">{message}</p>} */}
        <div className="space-y-3">
          {emailSent ? (
            <div className="text-green-600 text-sm">Check your email for a sign-in link.</div>
          ) : (
            <form onSubmit={handleEmail} className="space-y-2">
              {/* Email */}
              <input
                type="email"
                required
                placeholder="Email*"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                autoComplete="email"
              />
              {/* Password */}
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'} // Toggle input type
                  required={mode === 'signup'}
                  placeholder="Password*"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {/* Only show these fields on signup */}
              {mode === 'signup' && (
                <>
                  {/* Name */}
                  <input
                    type="text"
                    required={mode === 'signup'}
                    placeholder="Full Name*"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                    autoComplete="name"
                  />
                  {/* Parent Email (optional) */}
                  {/* <input
                    type="email"
                    placeholder="Parent's Email (optional)"
                    value={parentEmail}
                    onChange={(e) => setParentEmail(e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                    autoComplete="off"
                  /> */}
                  {/* Grade */}
                  {/* <input
                    type="text"
                    placeholder="Grade"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                    autoComplete="off"
                  /> */}
                  {/* Country */}
                  {/* <input
                    type="text"
                    placeholder="Country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                    autoComplete="country"
                  /> */}
                  {/* Profile Image URL */}
                  {/* <input
                    type="url"
                    placeholder="Profile Image URL"
                    value={profileImage}
                    onChange={(e) => setProfileImage(e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                    autoComplete="off"
                  /> */}
                </>
              )}

              <button
                type="submit"
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                disabled={loading}
              >
                {loading ? 'Processing...' : 'continue'}
              </button>
              {/* Divider */}
              <div className="relative flex items-center my-3">
                <div className="flex-grow border-t border-gray-300"></div>
                <span className="mx-2 text-gray-400 text-xs">or</span>
                <div className="flex-grow border-t border-gray-300"></div>
              </div>
              {/* Google */}
              <button
                onClick={handleGoogle}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 bg-white text-gray-700 font-medium"
                disabled={loading}
              >
                {/* ...SVG... */}
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <g>
                    <path
                      d="M19.6 10.23c0-.68-.06-1.36-.18-2H10v3.79h5.41a4.63 4.63 0 01-2.01 3.04v2.52h3.24c1.9-1.75 2.96-4.33 2.96-7.35z"
                      fill="#4285F4"
                    />
                    <path
                      d="M10 20c2.7 0 4.97-.89 6.63-2.41l-3.24-2.52c-.9.6-2.05.96-3.39.96-2.6 0-4.8-1.76-5.59-4.13H1.08v2.59A10 10 0 0010 20z"
                      fill="#34A853"
                    />
                    <path
                      d="M4.41 12.9A5.99 5.99 0 014.07 10c0-.99.18-1.95.34-2.9V4.51H1.08A10 10 0 000 10c0 1.64.4 3.19 1.08 4.51l3.33-2.61z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M10 3.96c1.47 0 2.78.51 3.81 1.51l2.85-2.85C14.97.89 12.7 0 10 0A10 10 0 001.08 4.51l3.33 2.59C5.2 5.72 7.4 3.96 10 3.96z"
                      fill="#EA4335"
                    />
                  </g>
                </svg>
                <span>{mode === 'signin' ? 'Sign in with Google' : 'Sign up with Google'}</span>
              </button>
              {/* Facebook */}
              <button
                onClick={handleFacebook}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 bg-white text-gray-700 font-medium mt-2"
                disabled={loading}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
                    fill="#1877F2"
                  />
                </svg>
                <span>{mode === 'signin' ? 'Sign in with Facebook' : 'Sign up with Facebook'}</span>
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
