import React from 'react';

/**
 * Dashboard layout
 * - Passes children through without constraining width.
 * - The page component owns its own max-width container (max-w-[1120px]).
 * - Navigation (TopBar) is handled by the parent (student) shell layout.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
