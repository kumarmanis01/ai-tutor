// components/Navbar.tsx
"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import { useState } from "react";
import LoginModal from "./LoginModal";
import Button from "@/components/UI/Button";
import Avatar from "@/components/UI/Avatar";

/**
 * Sticky top navigation bar. Always visible.
 * - Shows Sign in (when not authenticated) and Sign out (when authenticated).
 * - After sign in / sign out, user is redirected to the home page via callbackUrl.
 */
export default function Navbar() {
  const { data: session, status } = useSession();
  const [showLoginModal, setShowLoginModal] = useState(false);

  return (
    <header className="fixed top-0 left-0 w-full bg-white shadow z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="text-lg font-bold text-blue-600">
          AI Tutor
        </Link>

        {/* Navigation links */}
        {/* <nav className="flex items-center gap-6">
          <Link href="/" className="text-sm hover:text-blue-600">Home</Link>
          <Link href="/pricing" className="text-sm hover:text-blue-600">Pricing</Link> */}
        {/* Removed Profile link here */}
        {/* </nav> */}

        {/* Auth controls */}
        <div>
          {status === "loading" ? (
            <span className="text-sm text-gray-500">Loading...</span>
          ) : session ? (
            <div className="flex items-center gap-3">
              {/* Avatar and name are now a link to /profile */}
              <Link href="/profile" className="group">
                <Avatar
                  src={session.user?.image || undefined}
                  alt="User avatar"
                  size={32}
                  fallback={
                    session.user?.name
                      ? session.user.name.charAt(0).toUpperCase()
                      : session.user?.email?.charAt(0).toUpperCase()
                  }
                  className="group-hover:ring-2 group-hover:ring-blue-400 transition"
                />
              </Link>
              <Button
                variant="outline"
                onClick={() => signOut({ callbackUrl: "/" })}
                aria-label="Logout"
              >
                Logout
              </Button>
            </div>
          ) : (
            <>
              <Button
                onClick={() => setShowLoginModal(true)}
                aria-label="Login"
              >
                Login
              </Button>
              <LoginModal
                isOpen={showLoginModal}
                onClose={() => setShowLoginModal(false)}
                message="Please login to continue."
              />
            </>
          )}
        </div>
      </div>
    </header>
  );
}
