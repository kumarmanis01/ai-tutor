'use client'

/**
 * PaymentMethodManager
 *
 * FILE OBJECTIVE:
 * - Show saved payment methods on the parent billing page (F-PAR-031 AC-01).
 * - Allow removing a method after a new one is verified (F-PAR-031 AC-05).
 *   Guards against removing the only remaining method.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/parent/subscription/PaymentMethodManager.test.tsx
 *
 * EDIT LOG:
 * - 2026-05-05T00:00:00Z | staff-engineer | initial implementation (F-PAR-031 AC-01/05)
 */

import { useState } from 'react'
import { logger } from '@/lib/logger'

interface SavedMethod {
  id: string
  type: string
  last4: string | null
  cardBrand: string | null
  isDefault: boolean
  verified: boolean
}

interface PaymentMethodManagerProps {
  initialMethods: SavedMethod[]
}

function methodLabel(m: SavedMethod): string {
  if (m.type === 'upi') return 'UPI'
  if (m.type === 'netbanking') return 'Net banking'
  const brand = m.cardBrand ? `${m.cardBrand} ` : ''
  const last4 = m.last4 ? `ending ${m.last4}` : ''
  return `${brand}Card ${last4}`.trim() || 'Card'
}

export default function PaymentMethodManager({ initialMethods }: PaymentMethodManagerProps) {
  const [methods, setMethods] = useState<SavedMethod[]>(initialMethods)
  const [removing, setRemoving] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function removeMethod(id: string) {
    setRemoving(id)
    setMessage(null)
    try {
      const res = await fetch(`/api/parent/payment-methods?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage((json as any)?.error ?? 'Could not remove payment method')
        return
      }
      setMethods((prev) => {
        const remaining = prev.filter((m) => m.id !== id)
        const hadDefault = prev.find((m) => m.id === id)?.isDefault ?? false
        if (hadDefault && remaining.length > 0) {
          remaining[0] = { ...remaining[0], isDefault: true }
        }
        return remaining
      })
      setMessage('Payment method removed')
    } catch (err) {
      logger.error('PaymentMethodManager: remove failed', { error: String(err), id })
      setMessage('Could not remove payment method')
    } finally {
      setRemoving(null)
    }
  }

  if (methods.length === 0) return null

  return (
    <section className="mb-6 rounded-xl border bg-white p-4 dark:bg-gray-900 dark:border-gray-700">
      <h2 className="text-sm font-semibold mb-3 text-gray-900 dark:text-gray-50">Payment methods on file</h2>
      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
        {methods.map((m) => (
          <li key={m.id} className="flex items-center justify-between py-2.5 gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                {methodLabel(m)}
              </span>
              {m.isDefault && (
                <span className="shrink-0 rounded-full bg-[#EEEDFE] px-2 py-0.5 text-[10px] font-medium text-[#534AB7] dark:bg-indigo-950 dark:text-indigo-300">
                  Default
                </span>
              )}
              {!m.verified && (
                <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-[#BA7517] dark:bg-amber-950 dark:text-amber-300">
                  Unverified
                </span>
              )}
            </div>
            {/* Only allow removal when another method exists (F-PAR-031 AC-05: new method validated first) */}
            {methods.length > 1 && (
              <button
                type="button"
                onClick={() => removeMethod(m.id)}
                disabled={removing === m.id}
                className="shrink-0 min-h-[44px] min-w-[44px] rounded border border-[#E24B4A]/40 px-3 py-1 text-xs font-medium text-[#E24B4A] hover:bg-[#FCEBEB] disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
              >
                {removing === m.id ? 'Removing...' : 'Remove'}
              </button>
            )}
          </li>
        ))}
      </ul>
      {message && (
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">{message}</p>
      )}
    </section>
  )
}
