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

interface Props {
  children: React.ReactNode;
}

export default function RootLayout({ children }: Props) {
  return (
    <html lang="en">
      <head />
      <body>
        {children}
      </body>
    </html>
  );
}
