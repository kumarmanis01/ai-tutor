import React from 'react';
import TopBar from './components/TopBar';

/**
 * Dashboard layout
 * - Renders the app TopBar and a simple dashboard tab navigation
 * - Children are rendered below the navigation
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const tabs = [
    { href: '/dashboard', label: 'Home' },
    { href: '/dashboard/notes', label: 'Notes' },
    { href: '/dashboard/tests', label: 'Practice' },
    { href: '/dashboard/doubts', label: 'Doubts' },
    { href: '/dashboard/profile', label: 'Profile' },
  ];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 bg-white border-b z-50">
        <TopBar studentName="" />
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {children}
      </main>
    </div>
  );
}
