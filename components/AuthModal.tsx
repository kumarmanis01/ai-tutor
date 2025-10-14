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
  const [country, setCountry] = useState(''); // <-- Add country
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
    // After Google sign-in, prompt for country if not set (can be handled in profile page)
  };

  //   return (
  //     <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
  //       <div className="bg-white rounded-lg shadow-lg w-full max-w-sm p-6 relative">
  //         <button
  //           onClick={onClose}
  //           className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
  //         >
  //           ✕
  //         </button>
  //         <h2 className="text-lg font-semibold mb-2">Continue with Google</h2>
  //         {message && <p className="text-sm text-gray-600 mb-4">{message}</p>}
  //         <div className="space-y-3">
  //           {/* Google */}
  //           <button
  //             onClick={handleGoogle}
  //             className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 bg-white text-gray-700 font-medium"
  //             disabled={loading}
  //           >
  //             {/* ...SVG... */}
  //             <span>Sign in with Google</span>
  //           </button>
  //         </div>
  //       </div>
  //     </div>
  //   );
  // }
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
        body: JSON.stringify({ name, email, parentEmail, profileImage, grade, password, country }),
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
            {/* ...SVG... */}
            <span>{mode === 'signin' ? 'Sign in with Google' : 'Sign up with Google'}</span>
          </button>
          {/* Divider */}
          <div className="relative flex items-center my-3">
            <div className="flex-grow border-t border-gray-300"></div>
            <span className="mx-2 text-gray-400 text-xs">or</span>
            <div className="flex-grow border-t border-gray-300"></div>
          </div>
          Email Form
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
                  {/* Country */}
                  <input
                    type="text"
                    placeholder="Country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                    autoComplete="country"
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
