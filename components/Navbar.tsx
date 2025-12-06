'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';
import useCurrentUser from '@/hooks/useCurrentUser';
import AuthModal from './AuthModal';
import Avatar from '@/components/UI/Avatar';

/**
 * Sticky top navigation bar. Always visible.
 * - Shows Sign in (when not authenticated) and Sign out (when authenticated).
 * - Shows Rooms link only if user is logged in and has an active paid subscription (not free).
 * - After sign in / sign out, user is redirected to the home page via callbackUrl.
 * - Login/Logout buttons respect dark/light mode.
 */
export default function Navbar() {
  const { data: session, status } = useSession();
  const { data: profile } = useCurrentUser();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);

  // Sync dark mode with localStorage and <html> class
  useEffect(() => {
    const stored = localStorage.getItem('theme');
    if (
      stored === 'dark' ||
      (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)
    ) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
      return next;
    });
  };

  // Check for active paid subscription using API
  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/subscription/status')
        .then((res) => res.json())
        .then((data) => setHasActiveSubscription(data.isPremium));
    }
  }, [status]);

  // Log session status and subscription status using logger
  useEffect(() => {
    try {
      logger.add(`Navbar session status: ${status}, hasActiveSubscription: ${String(
        hasActiveSubscription,
      )}`, { className: 'Navbar', methodName: 'statusEffect' });
    } catch {
      // fallback noop
    }
  }, [status, hasActiveSubscription]);

  // Button styles for dark/light mode
  const buttonClass =
    'px-4 py-2 rounded font-semibold transition ' +
    (darkMode
      ? 'bg-yellow-300 text-blue-900 hover:bg-yellow-400'
      : 'bg-indigo-600 text-white hover:bg-indigo-700');

  const outlineButtonClass =
    'px-4 py-2 rounded font-semibold border transition ' +
    (darkMode
      ? 'border-yellow-300 text-yellow-300 hover:bg-yellow-300 hover:text-blue-900'
      : 'border-indigo-600 text-indigo-600 hover:bg-indigo-600 hover:text-white');

  return (
    <header className="fixed top-0 left-0 w-full bg-white dark:bg-gray-900 shadow z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold text-blue-600 dark:text-yellow-300"
        >
          <span className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 dark:bg-yellow-300 text-white dark:text-blue-900 font-extrabold text-base">
            SA
          </span>
          <span>Spinzy Academy</span>
        </Link>

        {/* Night/Day toggle */}
        <button
          onClick={toggleDarkMode}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          className="mr-4 text-xl focus:outline-none"
        >
          {darkMode ? '🌙' : '☀️'}
        </button>

        {/* Navigation Links */}
        {/* Show Rooms link only for logged-in users with active paid subscription */}
        {/* <nav className="flex gap-6 items-center">
          {status === 'authenticated' && hasActiveSubscription && (
            <Link href="/rooms" className="font-bold text-indigo-600 dark:text-yellow-300">
              Rooms
            </Link>
          )}
        </nav> */}

        {/* Auth controls */}
        <div>
          {status === 'loading' ? (
            <span className="text-sm text-gray-500">Loading...</span>
          ) : session ? (
            <div className="flex items-center gap-3">
              <Link href="/profile" className="group">
                <Avatar
                  src={(profile?.image ?? session.user?.image) || undefined}
                  alt="User avatar"
                  size={32}
                  fallback={
                    profile?.name
                      ? profile.name.charAt(0).toUpperCase()
                      : session.user?.name
                      ? session.user.name.charAt(0).toUpperCase()
                      : session.user?.email?.charAt(0).toUpperCase()
                  }
                  className="group-hover:ring-2 group-hover:ring-blue-400 transition"
                />
              </Link>
              <button
                className={outlineButtonClass}
                onClick={() => signOut({ callbackUrl: '/' })}
                aria-label="Logout"
              >
                Logout
              </button>
            </div>
          ) : (
            <>
              <button
                className={buttonClass}
                onClick={() => setShowAuthModal(true)}
                aria-label="Login"
              >
                Login
              </button>
              <AuthModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                message="Please login to continue."
              />
            </>
          )}
        </div>
      </div>
    </header>
  );
}
