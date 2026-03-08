/**
 * FILE OBJECTIVE:
 * - Root layout shell for all parent-facing routes under app/(parent)/.
 * - Owns the HTML document for authenticated parent routes (/parent/dashboard, etc.).
 * - Intentionally minimal — does not share the student shell (StudentNav, session engine).
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Parent Progress Dashboard
 */

import type { Metadata } from 'next';
import '@/styles/index.css';

export const metadata: Metadata = {
  title: 'Parent Dashboard | Spinzy Academy',
  description: "Monitor your child's learning progress on Spinzy Academy.",
};

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen bg-gray-50 antialiased">
        {children}
      </body>
    </html>
  );
}
