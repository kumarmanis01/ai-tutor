'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function RefreshButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  function refresh() {
    setBusy(true)
    router.refresh()
    // brief visual feedback only
    setTimeout(() => setBusy(false), 800)
  }

  return (
    <button
      onClick={refresh}
      disabled={busy}
      className="text-[11px] px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 min-h-[32px] transition-colors"
    >
      {busy ? 'Refreshing...' : 'Refresh'}
    </button>
  )
}
