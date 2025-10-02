'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import type { SessionUser } from '@/lib/types';

export default function Footer() {
  const { data: session } = useSession();

  // Type guard for SessionUser
  const isAdmin = session && session.user && (session.user as SessionUser).role === 'admin';

  return (
    <footer className="w-full bg-gray-100 border-t mt-12">
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-gray-600 text-sm">
          &copy; {new Date().getFullYear()} AI Tutor. All rights reserved.
        </div>
        <nav className="flex gap-4 text-sm items-center">
          <Link href="/" className="hover:text-blue-600">
            Home
          </Link>
          <Link href="/pricing" className="hover:text-blue-600">
            Pricing
          </Link>
          <Link href="/about" className="hover:text-blue-600">
            About
          </Link>
          <Link href="/privacy" className="hover:text-blue-600">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-blue-600">
            Terms of Service
          </Link>
          {isAdmin && (
            <Link href="/admin" className="hover:text-blue-600 font-semibold">
              Admin Dashboard
            </Link>
          )}
        </nav>
        <div className="text-gray-400 text-xs">
          Made with <span className="text-red-500">&hearts;</span> by Spinzy Digital
        </div>
      </div>
    </footer>
  );
}
