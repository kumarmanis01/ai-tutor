'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';

/**
 * TopBar Navigation
 * - Shows app-wide links (Home, Pricing, Profile)
 * - Handles login state (Login/Logout button)
 * - Modular → Easily extendable for more links
 */
export default function TopBar() {
  const { data: session } = useSession();

  return (
    <header className="bg-white shadow-md w-full sticky top-0 z-50">
      <nav className="max-w-6xl mx-auto flex justify-between items-center px-6 py-3">
        {/* Left → Brand */}
        <Link href="/" className="text-xl font-bold text-blue-600">
          Spinzy Academy
        </Link>

        {/* Middle → Navigation */}
        <div className="flex space-x-6">
          <Link href="/" className="hover:text-blue-500">
            Home
          </Link>
          <Link href="/pricing" className="hover:text-blue-500">
            Pricing
          </Link>
          <Link href="/profile" className="hover:text-blue-500">
            Profile
          </Link>
        </div>

        {/* Right → Auth buttons */}
        <div>
          {session ? (
            <button
              onClick={() => signOut()}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              Logout
            </button>
          ) : (
            <Link
              href="/auth/signin"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Login
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
