'use client';

import { SessionProvider, useSession } from 'next-auth/react';
import Script from 'next/script';
import Navbar from '@/components/Navbar';
import Footer from '@/components/UI/Footer';

function AuthAwareLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const loggedIn = Boolean(session?.user);

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <Navbar /> {/* Fixed, always on top */}
      <div className="flex flex-col min-h-screen">
        {/* Main content area, with top padding to avoid being hidden by Navbar */}
        <main className="flex-1 overflow-y-auto pt-16">{children}</main>
        {/* Adjust pt-16 to match your Navbar height (16 * 4px = 64px) */}
        {!loggedIn && <Footer />}
      </div>
    </>
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthAwareLayout>{children}</AuthAwareLayout>
    </SessionProvider>
  );
}
