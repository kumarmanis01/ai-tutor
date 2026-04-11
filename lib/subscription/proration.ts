/**
 * Proration helper utilities for subscriptions.
 *
 * All amounts are integers in paise.
 */
export function computeProratedCredit(
  startIso: string | Date,
  endIso: string | Date,
  paidAmountPaise: number,
  nowDate?: Date,
): number {
  const start = typeof startIso === 'string' ? new Date(startIso) : startIso;
  const end = typeof endIso === 'string' ? new Date(endIso) : endIso;
  const now = nowDate ?? new Date();

  const totalMs = end.getTime() - start.getTime();
  if (totalMs <= 0) return 0;

  const remainingMs = Math.max(0, end.getTime() - now.getTime());
  if (remainingMs <= 0) return 0;

  const fraction = remainingMs / totalMs;
  const credit = Math.floor(paidAmountPaise * fraction);
  return credit;
}

export default computeProratedCredit;
