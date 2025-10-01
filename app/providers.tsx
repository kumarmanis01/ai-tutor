'use client';

import { SessionProvider } from 'next-auth/react';
import Script from 'next/script';
import Navbar from '@/components/Navbar';
import Footer from '@/components/UI/Footer';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />

      <div className="flex flex-col min-h-screen">
        {/* Sticky navbar */}
        <div className="sticky top-0 z-20">
          <Navbar />
        </div>

        {/* Main content area, scrollable if needed */}
        <main className="flex-1 overflow-y-auto">{children}</main>

        {/* Sticky footer */}
        <div className="sticky bottom-0 z-20">
          <Footer />
        </div>
      </div>
    </SessionProvider>
  );
}
