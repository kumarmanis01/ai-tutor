'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import useCurrentUser from '@/hooks/useCurrentUser';

export default function Footer() {
  const { data: session } = useSession();
  const { data: profile } = useCurrentUser();
  const sess = session as unknown as import('@/lib/types/auth').AppSession | null;

  // Prefer canonical profile role if available, otherwise fall back to session role.
  const isAdmin = (() => {
    const profRole = (profile as any)?.role;
    const sessRole = sess?.user?.role;
    return profRole === 'admin' || sessRole === 'admin';
  })();

  return (
    <footer className="w-full bg-gray-100 border-t mt-1">
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-gray-600 text-sm">
          &copy; {new Date().getFullYear()} Spinzy Academy. All rights reserved.
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
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-blue-600">
            Terms
          </Link>
          <Link href="/contact-us" className="hover:text-blue-600">
            Contact
          </Link>
          <Link href="/refund" className="hover:text-blue-600">
            Refund
          </Link>
          {isAdmin && (
            <Link href="/admin" className="hover:text-blue-600 font-semibold">
              Admin
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
