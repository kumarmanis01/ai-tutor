import React from 'react';
import Navbar from '@/components/Navbar';

/**
 * Public shell layout
 * - Wraps all public/marketing pages (/, /about, /pricing, /contact-us, etc.)
 * - Renders the public Navbar (auth-aware, dark-mode toggle)
 * - Must NOT be used inside student or admin route groups
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}
