import { prisma } from '@/lib/prisma'

export type PaymentEventPayload = {
  paymentId?: string
  userId?: string
  provider: string
  providerIdempotencyKey?: string
  transactionId?: string
  orderId?: string
  eventType: string
  payload?: any
  amount?: number
  status?: string
}

/**
 * Record a payment lifecycle event. Accepts either a Prisma transaction object
 * (tx) or will use the top-level `prisma` client. This keeps event writes
 * colocated with transactional payment writes when needed.
 */
export async function recordPaymentEvent(prismaOrTx: any, ev?: PaymentEventPayload) {
  // Allow calling as recordPaymentEvent(ev) or recordPaymentEvent(tx, ev)
  let tx: any
  let data: PaymentEventPayload | undefined
  if (ev === undefined) {
    // called as recordPaymentEvent(evOnly)
    data = prismaOrTx as PaymentEventPayload
    tx = null
  } else {
    tx = prismaOrTx
    data = ev
  }

  const row = {
    paymentId: data?.paymentId ?? undefined,
    userId: data?.userId ?? undefined,
    provider: data?.provider,
    providerIdempotencyKey: data?.providerIdempotencyKey ?? undefined,
    transactionId: data?.transactionId ?? undefined,
    orderId: data?.orderId ?? undefined,
    eventType: data?.eventType,
    payload: data?.payload ?? undefined,
    amount: data?.amount ?? undefined,
    status: data?.status ?? undefined,
  }

  if (tx && tx.paymentEvent && typeof tx.paymentEvent.create === 'function') {
    return tx.paymentEvent.create({ data: row as any })
  }

  return prisma.paymentEvent.create({ data: row as any })
}
