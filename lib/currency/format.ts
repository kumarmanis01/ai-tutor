/**
 * Currency and status formatting helpers used by billing UI
 *
 * FILE OBJECTIVE:
 * - Provide small utilities to format INR paise values and map installment statuses
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/currency/format.test.ts
 *
 * EDIT LOG:
 * - 2026-04-17T00:00:00Z | assistant | created
 */

export function formatINR(paise: number | null | undefined) {
  const rupees = (paise ?? 0) / 100
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(rupees)
  } catch {
    return '₹' + (rupees.toFixed(2))
  }
}

export function statusLabel(s: unknown) {
  const st = String(s ?? '').toUpperCase()
  switch (st) {
    case 'PAID':
      return 'Paid'
    case 'PENDING':
      return 'Pending'
    case 'FAILED':
      return 'Failed'
    case 'CANCELLED':
      return 'Cancelled'
    default:
      return st || '--'
  }
}

export default { formatINR, statusLabel }
