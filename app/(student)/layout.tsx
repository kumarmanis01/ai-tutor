import React from 'react';
import StudentTopBar from './dashboard/components/TopBar';

/**
 * Student shell layout
 * - Wraps all authenticated student routes (/dashboard/*, /rooms/*)
 * - Renders the student TopBar (greeting, theme toggle, tab navigation)
 * - Must NOT render the public Navbar
 *
 * Note: dashboard/layout.tsx provides the page-level <main> container.
 *       This layout provides the persistent top navigation only.
 */
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <StudentTopBar studentName="" />
      {children}
    </div>
  );
}
