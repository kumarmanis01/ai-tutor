/**
 * FILE OBJECTIVE:
 * - WhatsApp webhook endpoint for receiving incoming messages.
 * - Handles opt-in/opt-out via keyword replies ("START", "STOP").
 * - Handles WhatsApp webhook verification (GET challenge).
 * - Fail-safe: never throws to WhatsApp — always returns 200.
 *
 * Environment variables:
 *   WHATSAPP_VERIFY_TOKEN  - Token for webhook verification handshake
 *   WHATSAPP_ENABLED       - "1" to enable
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created WhatsApp webhook for opt-in/opt-out
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { setWhatsAppOptIn } from '@/lib/whatsapp';

const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || '';
const WHATSAPP_ENABLED = process.env.WHATSAPP_ENABLED === '1';

// Keywords that trigger opt-in/opt-out
const OPT_IN_KEYWORDS = ['start', 'subscribe', 'yes', 'haan', 'ha', 'shuru'];
const OPT_OUT_KEYWORDS = ['stop', 'unsubscribe', 'no', 'nahi', 'band', 'ruko'];

/**
 * GET /api/whatsapp/webhook
 * WhatsApp webhook verification (challenge-response).
 * Meta sends a GET with hub.mode, hub.verify_token, hub.challenge.
 */
export async function GET(req: NextRequest) {
  if (!WHATSAPP_ENABLED) {
    return NextResponse.json({ error: 'WhatsApp disabled' }, { status: 403 });
  }

  const mode = req.nextUrl.searchParams.get('hub.mode');
  const token = req.nextUrl.searchParams.get('hub.verify_token');
  const challenge = req.nextUrl.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
    logger.info('whatsapp.webhook.verified');
    // Must return the challenge as plain text
    return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  logger.warn('whatsapp.webhook.verificationFailed', { mode, tokenMatch: token === WHATSAPP_VERIFY_TOKEN });
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

/**
 * POST /api/whatsapp/webhook
 * Receives incoming WhatsApp messages.
 * Processes opt-in/opt-out keywords from parents.
 */
export async function POST(req: NextRequest) {
  // Always return 200 to WhatsApp to prevent retries
  try {
    if (!WHATSAPP_ENABLED) {
      return NextResponse.json({ status: 'disabled' }, { status: 200 });
    }

    const body = await req.json();

    // WhatsApp Cloud API webhook structure
    const entries = body?.entry;
    if (!Array.isArray(entries)) {
      return NextResponse.json({ status: 'ok' }, { status: 200 });
    }

    for (const entry of entries) {
      const changes = entry?.changes;
      if (!Array.isArray(changes)) continue;

      for (const change of changes) {
        if (change?.field !== 'messages') continue;

        const messages = change?.value?.messages;
        if (!Array.isArray(messages)) continue;

        for (const message of messages) {
          await processIncomingMessage(message).catch((err) => {
            logger.error('whatsapp.webhook.processError', {
              error: err instanceof Error ? err.message : String(err),
            });
          });
        }
      }
    }

    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (error) {
    // Never fail — WhatsApp will retry on non-200
    logger.error('whatsapp.webhook.error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  }
}

// ── Internal ──────────────────────────────────────────────────────────

async function processIncomingMessage(message: any): Promise<void> {
  if (message?.type !== 'text') return;

  const phone = message?.from;
  const text = (message?.text?.body || '').trim().toLowerCase();

  if (!phone || !text) return;

  // Find parent by phone number
  const parent = await findParentByPhone(phone);
  if (!parent) {
    logger.info('whatsapp.webhook.unknownPhone', { phone: maskPhone(phone) });
    return;
  }

  // Check for opt-in keywords
  if (OPT_IN_KEYWORDS.includes(text)) {
    await setWhatsAppOptIn(parent.id, true);
    logger.info('whatsapp.webhook.optIn', { parentId: parent.id });
    return;
  }

  // Check for opt-out keywords
  if (OPT_OUT_KEYWORDS.includes(text)) {
    await setWhatsAppOptIn(parent.id, false);
    logger.info('whatsapp.webhook.optOut', { parentId: parent.id });
    return;
  }

  // Unknown message — log and ignore
  logger.info('whatsapp.webhook.unrecognized', {
    parentId: parent.id,
    textLength: text.length,
  });
}

async function findParentByPhone(phone: string): Promise<{ id: string } | null> {
  // Normalize: WhatsApp sends numbers without '+', e.g., "919876543210"
  // Our DB may store with or without country code
  const variants: string[] = [phone];

  // If starts with country code 91, also try without it
  if (phone.startsWith('91') && phone.length === 12) {
    variants.push(phone.slice(2));
    variants.push('0' + phone.slice(2));
    variants.push('+' + phone);
  }

  const user = await prisma.user.findFirst({
    where: {
      phone: { in: variants },
      role: 'parent',
    },
    select: { id: true },
  });

  return user;
}

function maskPhone(phone: string): string {
  if (phone.length <= 4) return '****';
  return phone.slice(0, 2) + '***' + phone.slice(-2);
}
