/**
 * Standalone "Link a Child" page for parents.
 *
 * Route: /parent/link-child
 * Protected by the (parent) layout -- only role=parent users can reach this.
 *
 * EDIT LOG:
 *   2026-05-29 | claude | created -- fixes /parent/link-child 404 (BUG A)
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import LinkChildForm from '@/components/parent/LinkChildForm'

export const metadata: Metadata = {
  title: 'Link a Child | Spinzy',
  description: 'Connect your parent account to your child on Spinzy.',
}

export default function LinkChildPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        <Link
          href="/parent/dashboard"
          className="hover:text-[#534AB7] dark:hover:text-indigo-400 transition-colors"
        >
          Dashboard
        </Link>
        <span aria-hidden="true">&rsaquo;</span>
        <span className="font-medium text-gray-700 dark:text-gray-200">Link a Child</span>
      </nav>

      <h1 className="mb-1 text-xl font-bold text-gray-900 dark:text-gray-50">
        Link a child
      </h1>
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        Connect your parent account using your child&apos;s invite code or email address.
      </p>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 shadow-sm">
        <LinkChildForm />
      </div>
    </main>
  )
}
