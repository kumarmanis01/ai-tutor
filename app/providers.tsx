"use client";

import { SessionProvider } from "next-auth/react";
import Script from "next/script";
import Navbar from "@/components/Navbar";
import Footer from "@/components/UI/Footer";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {/* Razorpay script globally available */}
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
      />
      
      {/* Sticky navbar always visible */}
      <Navbar />

      <main className="pt-16">{children}</main>
      <Footer />
    </SessionProvider>
  );
}
