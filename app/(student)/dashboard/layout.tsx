import React from 'react';

/**
 * Dashboard layout
 * - Provides page-level container for all /dashboard/* routes.
 * - Navigation (TopBar) is handled by the parent (student) shell layout.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <main className="max-w-4xl mx-auto p-6">{children}</main>;
}
