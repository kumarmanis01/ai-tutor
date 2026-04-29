/**
 * FILE OBJECTIVE:
 * - Root layout for the Next.js App Router. Provides the required HTML scaffold
 *   so child pages (including `not-found.tsx`) have a root layout.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/layout.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-29T00:00:00Z | copilot | add minimal root layout to satisfy Next.js build
 */

import React from 'react';
import './globals.css';
import localFont from 'next/font/local';
import { Noto_Sans_Devanagari, Roboto } from 'next/font/google';

/**
 * FILE OBJECTIVE:
 * - Root layout for the Next.js App Router. Ensure deterministic HTML/body
 *   classes (include app-wide font variables) to avoid hydration mismatches.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/layout.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-29T00:00:00Z | copilot | include global font variables and stable html/body classes to fix hydration mismatch
 */

// Public/google fonts used in public shell
const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-roboto',
  display: 'swap',
});
const notoSansDevanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  weight: ['400', '500', '700'],
  variable: '--font-noto-sans-devanagari',
  display: 'swap',
});

// Self-hosted variable fonts used by authenticated shells
const inter = localFont({
  src: '../public/fonts/inter-latin-variable.woff2',
  variable: '--font-inter',
  display: 'swap',
});
const nunito = localFont({
  src: '../public/fonts/nunito-variable-latin.woff2',
  variable: '--font-nunito',
  display: 'swap',
});

interface Props {
  children: React.ReactNode;
}

export default function RootLayout({ children }: Props) {
  // Compose a deterministic set of classes on the html element so server
  // and client render identical attributes (prevents hydration mismatches).
  const htmlClasses = `h-full ${roboto.variable} ${notoSansDevanagari.variable} ${
    inter.variable
  } ${nunito.variable}`.trim();

  return (
    <html lang="en" className={htmlClasses}>
      <head />
      <body className="font-sans antialiased h-full">
        {children}
      </body>
    </html>
  );
}
