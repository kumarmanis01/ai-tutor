'use client'

import { signOut } from 'next-auth/react'

export default function ParentLogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login/parent' })}
      className="text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
    >
      Sign out
    </button>
  )
}
