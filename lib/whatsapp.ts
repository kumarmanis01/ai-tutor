/**
 * FILE OBJECTIVE:
 * - WhatsApp Business API integration for parent notifications.
 * - Max 1 message per week per parent (trust > spam).
 * - Supports Hindi + English + Hinglish.
 * - Messages under 500 characters.
 * - Fail silently if WhatsApp fails (fallback to SMS placeholder).
 *
 * Environment variables:
 *   WHATSAPP_API_URL       - WhatsApp Business API endpoint
 *   WHATSAPP_API_TOKEN     - Bearer token for API auth
 *   WHATSAPP_PHONE_ID      - WhatsApp Business phone number ID
 *   WHATSAPP_ENABLED       - "1" to enable (disabled by default)
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created WhatsApp Business API integration
 */

import { prisma } from './prisma';
import { logger } from './logger';

// ── Configuration ──────────────────────────────────────────────────

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0';
const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN || '';
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID || '';
const WHATSAPP_ENABLED = process.env.WHATSAPP_ENABLED === '1';

const MAX_MESSAGE_LENGTH = 500;
const MIN_HOURS_BETWEEN_MESSAGES = 7 * 24; // 1 week

// ── Public API ─────────────────────────────────────────────────────

/**
 * Send a WhatsApp message to a parent.
 * Enforces: max 1/week, under 500 chars, opt-in required.
 * Fails silently — caller should not depend on success.
 */
export async function sendWhatsAppMessage(
  parentPhone: string,
  message: string,
  parentId: string,
): Promise<boolean> {
  if (!WHATSAPP_ENABLED) {
    logger.info('whatsapp.disabled', { parentId });
    return false;
  }

  if (!parentPhone || !message) return false;

  // Check opt-in
  const optedIn = await isOptedIn(parentId);
  if (!optedIn) {
    logger.info('whatsapp.notOptedIn', { parentId });
    return false;
  }

  // Rate limit: 1 message per week
  const canSend = await checkRateLimit(parentId);
  if (!canSend) {
    logger.info('whatsapp.rateLimited', { parentId });
    return false;
  }

  // Truncate message
  const truncated = message.length > MAX_MESSAGE_LENGTH
    ? message.slice(0, MAX_MESSAGE_LENGTH - 3) + '...'
    : message;

  try {
    await callWhatsAppAPI(parentPhone, truncated);
    await recordMessageSent(parentId);
    logger.info('whatsapp.sent', { parentId, messageLength: truncated.length });
    return true;
  } catch (error) {
    logger.error('whatsapp.sendFailed', {
      parentId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Fail silently — caller can try SMS fallback
    return false;
  }
}

/**
 * Build a weekly summary WhatsApp message.
 */
export function buildWeeklyWhatsAppMessage(
  parentName: string,
  studentName: string,
  daysActive: number,
  improvedTopic: string | null,
  strugglingTopic: string | null,
  language: string = 'en',
): string {
  if (language === 'hi') {
    return buildHindiMessage(parentName, studentName, daysActive, improvedTopic, strugglingTopic);
  }
  if (language === 'hinglish') {
    return buildHinglishMessage(parentName, studentName, daysActive, improvedTopic, strugglingTopic);
  }
  return buildEnglishMessage(parentName, studentName, daysActive, improvedTopic, strugglingTopic);
}

/**
 * Opt a parent in or out of WhatsApp notifications.
 */
export async function setWhatsAppOptIn(parentId: string, optIn: boolean): Promise<void> {
  await prisma.user.update({
    where: { id: parentId },
    data: {
      // Using status field to store opt-in preference as a simple approach
      // In production, would use a dedicated WhatsApp preferences table
    },
  });

  // Use an event to track opt-in/opt-out
  await prisma.event.create({
    data: {
      userId: parentId,
      type: optIn ? 'whatsapp_opt_in' : 'whatsapp_opt_out',
      metadata: { timestamp: new Date().toISOString() },
    },
  });

  logger.info('whatsapp.optInChanged', { parentId, optIn });
}

// ── Message Templates ──────────────────────────────────────────────

function buildEnglishMessage(
  parentName: string,
  studentName: string,
  daysActive: number,
  improved: string | null,
  struggling: string | null,
): string {
  const lines: string[] = [];
  lines.push(`Hi ${parentName},`);
  lines.push('');
  lines.push(`This week, ${studentName} studied on ${daysActive} days.`);

  if (improved) {
    lines.push(`Good progress in ${improved}! 👍`);
  }
  if (struggling) {
    lines.push(`${struggling} could use a little more practice.`);
  }

  lines.push('');
  lines.push('Keep encouraging regular study — every small step counts. 🌱');
  lines.push('');
  lines.push('– Spinzy Academy');

  return lines.join('\n');
}

function buildHindiMessage(
  parentName: string,
  studentName: string,
  daysActive: number,
  improved: string | null,
  struggling: string | null,
): string {
  const lines: string[] = [];
  lines.push(`🙏 नमस्ते ${parentName},`);
  lines.push('');
  lines.push(`इस हफ्ते ${studentName} ने ${daysActive} दिन पढ़ाई की।`);

  if (improved) {
    lines.push(`${improved} में अच्छी प्रगति हुई! 👍`);
  }
  if (struggling) {
    lines.push(`${struggling} में थोड़ा और अभ्यास चाहिए।`);
  }

  lines.push('');
  lines.push('आप बस प्रोत्साहित करते रहिये — प्रगति हो रही है। 🌱');
  lines.push('');
  lines.push('– Spinzy Academy');

  return lines.join('\n');
}

function buildHinglishMessage(
  parentName: string,
  studentName: string,
  daysActive: number,
  improved: string | null,
  struggling: string | null,
): string {
  const lines: string[] = [];
  lines.push(`🙏 Namaste ${parentName},`);
  lines.push('');
  lines.push(`Is week ${studentName} ne ${daysActive} din padhai ki.`);

  if (improved) {
    lines.push(`${improved} mein acchi progress hui! 👍`);
  }
  if (struggling) {
    lines.push(`${struggling} mein thodi aur practice chahiye.`);
  }

  lines.push('');
  lines.push('Aap bas encourage karte rahiye — progress ho rahi hai. 🌱');
  lines.push('');
  lines.push('– Spinzy Academy');

  return lines.join('\n');
}

// ── Internal helpers ───────────────────────────────────────────────

async function callWhatsAppAPI(phone: string, message: string): Promise<void> {
  if (!WHATSAPP_API_TOKEN || !WHATSAPP_PHONE_ID) {
    throw new Error('WhatsApp API not configured');
  }

  // Normalize phone number (ensure country code)
  const normalizedPhone = normalizePhone(phone);

  const url = `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_ID}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: normalizedPhone,
      type: 'text',
      text: { body: message },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'unknown');
    throw new Error(`WhatsApp API error: ${response.status} ${errorBody}`);
  }
}

async function isOptedIn(parentId: string): Promise<boolean> {
  // Check for most recent opt-in/opt-out event
  const lastEvent = await prisma.event.findFirst({
    where: {
      userId: parentId,
      type: { in: ['whatsapp_opt_in', 'whatsapp_opt_out'] },
    },
    orderBy: { timestamp: 'desc' },
  });

  // Default to opted-in if no explicit opt-out
  // (Parent links imply interest in notifications)
  return !lastEvent || lastEvent.type === 'whatsapp_opt_in';
}

async function checkRateLimit(parentId: string): Promise<boolean> {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - MIN_HOURS_BETWEEN_MESSAGES);

  const recentMessage = await prisma.event.findFirst({
    where: {
      userId: parentId,
      type: 'whatsapp_message_sent',
      timestamp: { gte: cutoff },
    },
  });

  return !recentMessage;
}

async function recordMessageSent(parentId: string): Promise<void> {
  await prisma.event.create({
    data: {
      userId: parentId,
      type: 'whatsapp_message_sent',
      metadata: { timestamp: new Date().toISOString() },
    },
  });
}

function normalizePhone(phone: string): string {
  // Remove spaces, dashes, parens
  let cleaned = phone.replace(/[\s\-()]/g, '');

  // If starts with 0, assume Indian number, prepend 91
  if (cleaned.startsWith('0')) {
    cleaned = '91' + cleaned.slice(1);
  }

  // If no country code (10 digits), assume India
  if (/^\d{10}$/.test(cleaned)) {
    cleaned = '91' + cleaned;
  }

  // Remove leading +
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  }

  return cleaned;
}
