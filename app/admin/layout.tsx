'use server';

import { getServerSessionForHandlers } from '@/lib/session';
import { notFound } from 'next/navigation';
import AdminSidebar from '@/components/Admin/AdminSidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSessionForHandlers();

  // If there's no session or the user is not an admin, return 404 to hide the admin area
  if (!session || (session.user && session.user.role !== 'admin')) {
    notFound();
  }

  return (
    <div className="flex min-h-screen pt-16 bg-gray-50 dark:bg-gray-900">
      <AdminSidebar />
      {/* Main content */}
      <main className="flex-1 p-8 text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 rounded-lg">
        {children}
      </main>
    </div>
  );
}
