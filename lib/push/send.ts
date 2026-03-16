import webpush from 'web-push'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

let vapidConfigured = false

function ensureVapidConfigured(): void {
  if (vapidConfigured) return
  const subject = process.env.VAPID_SUBJECT
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!subject || !publicKey || !privateKey) return // no-op in test/dev without keys
  webpush.setVapidDetails(subject, publicKey, privateKey)
  vapidConfigured = true
}

export interface PushPayload {
  title: string
  body: string
  icon?: string           // default: '/icons/icon-192.png'
  badge?: string          // default: '/icons/icon-72.png'
  url?: string            // deep link on tap
  tag?: string            // replaces previous notification with same tag
  requireInteraction?: boolean // true for exam reminders — don't auto-dismiss
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number }> {
  ensureVapidConfigured()
  const subscriptions = await prisma.pushSubscriptionRecord.findMany({
    where: { userId },
  })
  if (subscriptions.length === 0) return { sent: 0, failed: 0 }

  const notification = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon ?? '/icons/icon-192.png',
    badge: payload.badge ?? '/icons/icon-72.png',
    url: payload.url ?? '/dashboard',
    tag: payload.tag,
    requireInteraction: payload.requireInteraction ?? false,
  })

  let sent = 0
  let failed = 0

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        notification,
        { TTL: 86400 }, // valid for 24h if device offline
      )
      sent++
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode
      if (statusCode === 410 || statusCode === 404) {
        // Subscription expired — clean it up
        await prisma.pushSubscriptionRecord.delete({ where: { id: sub.id } }).catch(() => {})
      } else {
        logger.warn('push.sendFailed', { userId, endpoint: sub.endpoint, statusCode })
      }
      failed++
    }
  }

  return { sent, failed }
}

export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<void> {
  // Process in batches of 50 — never flood the DB
  for (let i = 0; i < userIds.length; i += 50) {
    const batch = userIds.slice(i, i + 50)
    await Promise.allSettled(batch.map((id) => sendPushToUser(id, payload)))
  }
}

/** Never throws — call anywhere without try/catch. Push is best-effort. */
export async function sendPushSafe(userId: string, payload: PushPayload): Promise<void> {
  try {
    await sendPushToUser(userId, payload)
  } catch {
    // Push is best-effort — never let it affect the main flow
  }
}
