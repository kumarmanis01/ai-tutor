'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const adminLinks = [
  { href: '/admin/users', label: 'User Management' },
  { href: '/admin/audit-logs', label: 'Audit Logs' },
  { href: '/admin/api-usage', label: 'API Usage Stats' },
  { href: '/admin/payments/success', label: 'Successful Payments' },
  { href: '/admin/payments/failed', label: 'Failed Payments' },
  { href: '/admin/charts/users', label: 'User Signups Chart' },
  { href: '/admin/charts/api-usage', label: 'API Usage Chart' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen pt-16">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-100 border-r p-6">
        <nav className="flex flex-col gap-4">
          {adminLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`py-2 px-3 rounded hover:bg-blue-100 ${
                pathname === link.href ? 'bg-blue-200 font-semibold' : ''
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
      {/* Main content */}
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
