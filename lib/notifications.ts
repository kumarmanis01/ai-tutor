/**
 * FILE OBJECTIVE:
 * - Centralized notification router for all student/parent notification events.
 *   Decides channel(s) for each event type, enforces frequency caps, dispatches
 *   sends via lib/mail.ts and lib/whatsapp/templates.ts, and writes an audit row
 *   to NotificationAudit for every send attempt.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/notifications.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-05-09T00:00:00Z | staff-engineer | created per 09_notification_architecture.md AC-03/04/07
 */

import { prisma } from '@/lib/prisma';
import { getRedis } from '@/lib/redis';
import { sendEmail } from '@/lib/mail';
import { sendWhatsApp, buildParentDisengagedTemplate, buildStudentDisengagedTemplate } from '@/lib/whatsapp/templates';
import type { WaTemplateMessage } from '@/lib/whatsapp/sender';
import { logger } from '@/lib/logger';
import { NOTIFICATION_EVENT_TYPES } from '@/lib/constants/mail';
import type { NotificationEventTypeValue } from '@/lib/constants/mail';

// ── Types ─────────────────────────────────────────────────────────────────────

export type NotificationEventType = NotificationEventTypeValue;

export type NotificationChannel = 'email' | 'whatsapp' | 'push' | 'in_app';

export type NotificationSeverity = 'INFORMATIONAL' | 'IMPORTANT' | 'CRITICAL';

export type NotificationActor = 'student' | 'parent';

export interface NotificationEvent {
  eventType: NotificationEventType;
  studentId: string;
  parentId?: string;
  context: Record<string, string | number | boolean | undefined>;
  severity: NotificationSeverity;
  /** When true: evaluate routing and caps but do not dispatch or persist real sends */
  dryRun?: boolean;
}

export interface ChannelResult {
  channel: NotificationChannel;
  actor: NotificationActor;
  templateId: string;
  status: 'sent' | 'failed' | 'capped' | 'dry_run' | 'no_contact';
  error?: string;
  messageId?: string;
}

export interface RoutingResult {
  eventType: NotificationEventType;
  channels: ChannelResult[];
  skippedDryRun: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
}

// ── Frequency cap constants ───────────────────────────────────────────────────

const CAP = {
  student: {
    push:     { daily: 3,  weekly: 15 },
    whatsapp: { daily: 2,  weekly: 10 },
    email:    { daily: 1,  weekly: 2  },
    in_app:   { daily: -1, weekly: -1 },  // -1 = unlimited
  },
  parent: {
    push:     { daily: 0,  weekly: 0 },
    whatsapp: { daily: 2,  weekly: 8  },
    email:    { daily: 1,  weekly: 3  },
    in_app:   { daily: 0,  weekly: 0 },
  },
} as const;

// CRITICAL severity events bypass daily/weekly caps (but not blocking)
const CRITICAL_EXEMPT_CHANNELS: NotificationChannel[] = ['whatsapp', 'email'];

const MS_DAY  = 24 * 60 * 60 * 1000;
const MS_WEEK = 7 * MS_DAY;

// IST offset in minutes: UTC+5:30
const IST_OFFSET_MINUTES = 330;

function dailyResetTtlSeconds(): number {
  const now = new Date();
  const istNow = new Date(now.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
  const midnight = new Date(istNow);
  midnight.setHours(24, 0, 0, 0);
  return Math.ceil((midnight.getTime() - istNow.getTime()) / 1000);
}

function weeklyBucketKey(actorId: string, actor: NotificationActor, channel: NotificationChannel): string {
  const week = Math.floor(Date.now() / MS_WEEK);
  return `notif:cap:${actor}:${actorId}:${channel}:w${week}`;
}

function dailyBucketKey(actorId: string, actor: NotificationActor, channel: NotificationChannel): string {
  const dayUtc = Math.floor((Date.now() + IST_OFFSET_MINUTES * 60 * 1000) / MS_DAY);
  return `notif:cap:${actor}:${actorId}:${channel}:d${dayUtc}`;
}

async function checkAndIncrementCap(
  actorId: string,
  actor: NotificationActor,
  channel: NotificationChannel,
  severity: NotificationSeverity,
): Promise<{ allowed: boolean; reason?: string }> {
  // In-app and push-for-parents have no send (0 cap); block immediately
  const caps = CAP[actor][channel];
  if (caps.daily === 0) return { allowed: false, reason: `${channel}_not_used_for_${actor}` };

  // Unlimited channels always allowed
  if (caps.daily === -1) return { allowed: true };

  // CRITICAL severity bypasses daily/weekly caps for emergency channels
  if (severity === 'CRITICAL' && CRITICAL_EXEMPT_CHANNELS.includes(channel)) {
    return { allowed: true };
  }

  const redis = getRedis();
  if (!redis) {
    // No Redis: allow sends (degraded mode)
    logger.warn('[notifications] Redis unavailable -- frequency caps not enforced', { actorId, channel });
    return { allowed: true };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ioredis dynamic API
    const r = redis as any;

    const dKey = dailyBucketKey(actorId, actor, channel);
    const wKey = weeklyBucketKey(actorId, actor, channel);

    const [dailyCount, weeklyCount] = await Promise.all([
      r.get(dKey) as Promise<string | null>,
      r.get(wKey) as Promise<string | null>,
    ]);

    if (dailyCount && Number(dailyCount) >= caps.daily) {
      return { allowed: false, reason: 'daily_cap' };
    }
    if (weeklyCount && Number(weeklyCount) >= caps.weekly) {
      return { allowed: false, reason: 'weekly_cap' };
    }

    // Increment both counters
    const dailyTtl   = dailyResetTtlSeconds();
    const weeklyTtl  = 8 * 24 * 60 * 60;  // slightly over 1 week so it doesn't expire mid-week

    await Promise.all([
      r.set(dKey, String(Number(dailyCount ?? '0') + 1), 'EX', dailyTtl, 'XX').then(
        (res: unknown) => res === null
          ? r.set(dKey, '1', 'EX', dailyTtl)
          : null,
      ),
      r.set(wKey, String(Number(weeklyCount ?? '0') + 1), 'EX', weeklyTtl, 'XX').then(
        (res: unknown) => res === null
          ? r.set(wKey, '1', 'EX', weeklyTtl)
          : null,
      ),
    ]);

    return { allowed: true };
  } catch (err) {
    logger.warn('[notifications] cap check failed -- permissive allow', { actorId, channel, error: String(err) });
    return { allowed: true };
  }
}

// ── Routing table ─────────────────────────────────────────────────────────────
//
// Returns the list of (actor, channel, templateId) tuples to attempt for each event.

interface RouteSpec {
  actor: NotificationActor;
  channel: NotificationChannel;
  emailTemplateId?: string;
  waTemplateId?: string;
}

function getRoutes(eventType: NotificationEventType): RouteSpec[] {
  switch (eventType) {
    case NOTIFICATION_EVENT_TYPES.SIGNUP_COMPLETED:
      return [
        { actor: 'student', channel: 'email',    emailTemplateId: 'STUDENT_WELCOME'     },
        { actor: 'student', channel: 'whatsapp', waTemplateId:    'STUDENT_WELCOME'     },
        { actor: 'parent',  channel: 'email',    emailTemplateId: 'PARENT_WELCOME'      },
        { actor: 'parent',  channel: 'whatsapp', waTemplateId:    'PARENT_WELCOME'      },
      ];

    case NOTIFICATION_EVENT_TYPES.DIAGNOSTIC_COMPLETED:
      return [
        { actor: 'student', channel: 'in_app',   emailTemplateId: '' },
      ];

    case NOTIFICATION_EVENT_TYPES.PLAN_GENERATED:
      return [
        { actor: 'student', channel: 'in_app',   emailTemplateId: '' },
        { actor: 'student', channel: 'push',      emailTemplateId: '' },
        { actor: 'parent',  channel: 'whatsapp',  waTemplateId:    'PARENT_PLAN_GENERATED' },
      ];

    case NOTIFICATION_EVENT_TYPES.DAILY_REMINDER:
      return [
        { actor: 'student', channel: 'push', emailTemplateId: '' },
      ];

    case NOTIFICATION_EVENT_TYPES.STUDY_COMPLETED:
      return [
        { actor: 'student', channel: 'in_app', emailTemplateId: '' },
      ];

    case NOTIFICATION_EVENT_TYPES.STREAK_MILESTONE:
      return [
        { actor: 'student', channel: 'in_app',   emailTemplateId: '' },
        { actor: 'student', channel: 'push',      emailTemplateId: '' },
        { actor: 'parent',  channel: 'whatsapp',  waTemplateId:    'PARENT_STREAK_MILESTONE_7' },
      ];

    case NOTIFICATION_EVENT_TYPES.WEAK_TOPIC_SINGLE:
      return [
        { actor: 'student', channel: 'in_app', emailTemplateId: '' },
      ];

    case NOTIFICATION_EVENT_TYPES.WEAK_TOPIC_PATTERN:
      return [
        { actor: 'student', channel: 'in_app',  emailTemplateId: '' },
        { actor: 'student', channel: 'push',     emailTemplateId: '' },
        { actor: 'parent',  channel: 'whatsapp', waTemplateId:    'PARENT_WEAK_TOPIC_EXAM' },
      ];

    case NOTIFICATION_EVENT_TYPES.IMPROVEMENT_DETECTED:
      return [
        { actor: 'student', channel: 'in_app',   emailTemplateId: 'STUDENT_IMPROVEMENT_DETECTED' },
        { actor: 'student', channel: 'whatsapp',  waTemplateId:    'STUDENT_IMPROVEMENT_DETECTED' },
        { actor: 'parent',  channel: 'whatsapp',  waTemplateId:    'PARENT_IMPROVEMENT_DETECTED'  },
      ];

    case NOTIFICATION_EVENT_TYPES.CONCEPT_MASTERED:
      return [
        { actor: 'student', channel: 'in_app', emailTemplateId: '' },
      ];

    case NOTIFICATION_EVENT_TYPES.MISSED_ONE_DAY:
      return [
        { actor: 'student', channel: 'push', emailTemplateId: '' },
      ];

    case NOTIFICATION_EVENT_TYPES.MISSED_THREE_DAYS:
      return [
        { actor: 'student', channel: 'push',     emailTemplateId: '' },
        { actor: 'student', channel: 'whatsapp', waTemplateId:    'STUDENT_MISSED_THREE_DAYS' },
        { actor: 'parent',  channel: 'whatsapp', waTemplateId:    'PARENT_MISSED_THREE_DAYS'  },
      ];

    case NOTIFICATION_EVENT_TYPES.DISENGAGED_CRITICAL:
      return [
        { actor: 'student', channel: 'whatsapp', waTemplateId:    'STUDENT_DISENGAGED_CRITICAL' },
        { actor: 'student', channel: 'email',    emailTemplateId: 'STUDENT_DISENGAGED_CRITICAL' },
        { actor: 'parent',  channel: 'whatsapp', waTemplateId:    'PARENT_DISENGAGED_CRITICAL'  },
        { actor: 'parent',  channel: 'email',    emailTemplateId: 'PARENT_DISENGAGED_CRITICAL'  },
      ];

    case NOTIFICATION_EVENT_TYPES.EXAM_COUNTDOWN:
      return [
        { actor: 'student', channel: 'push',     emailTemplateId: '' },
        { actor: 'student', channel: 'in_app',   emailTemplateId: '' },
        { actor: 'parent',  channel: 'whatsapp', waTemplateId:    'PARENT_EXAM_COUNTDOWN' },
        { actor: 'parent',  channel: 'email',    emailTemplateId: 'PARENT_EXAM_COUNTDOWN' },
      ];

    case NOTIFICATION_EVENT_TYPES.REVISION_PLAN_READY:
      return [
        { actor: 'student', channel: 'in_app',   emailTemplateId: '' },
        { actor: 'student', channel: 'whatsapp', waTemplateId:    'STUDENT_EXAM_COUNTDOWN' },
        { actor: 'parent',  channel: 'whatsapp', waTemplateId:    'PARENT_REVISION_PLAN_READY' },
        { actor: 'parent',  channel: 'email',    emailTemplateId: 'PARENT_REVISION_PLAN_READY' },
      ];

    case NOTIFICATION_EVENT_TYPES.MOCK_TEST_SCHEDULED:
      return [
        { actor: 'student', channel: 'push', emailTemplateId: '' },
      ];

    case NOTIFICATION_EVENT_TYPES.MOCK_TEST_COMPLETED:
      return [
        { actor: 'student', channel: 'in_app',  emailTemplateId: 'STUDENT_MOCK_FEEDBACK' },
        { actor: 'parent',  channel: 'email',   emailTemplateId: 'PARENT_MOCK_SUMMARY'   },
        { actor: 'parent',  channel: 'whatsapp', waTemplateId:   'PARENT_MOCK_SUMMARY'   },
      ];

    case NOTIFICATION_EVENT_TYPES.EXAM_RISK_ALERT:
      return [
        { actor: 'student', channel: 'push',     emailTemplateId: '' },
        { actor: 'student', channel: 'in_app',   emailTemplateId: '' },
        { actor: 'parent',  channel: 'whatsapp', waTemplateId:    'PARENT_EXAM_RISK_ALERT' },
        { actor: 'parent',  channel: 'email',    emailTemplateId: 'PARENT_EXAM_RISK_ALERT' },
      ];

    case NOTIFICATION_EVENT_TYPES.CONFUSION_PATTERN:
      return [
        { actor: 'student', channel: 'in_app', emailTemplateId: '' },
        { actor: 'student', channel: 'push',   emailTemplateId: '' },
      ];

    case NOTIFICATION_EVENT_TYPES.DAILY_DIGEST:
      return [
        { actor: 'parent', channel: 'email',    emailTemplateId: 'PARENT_DAILY_DIGEST' },
      ];

    case NOTIFICATION_EVENT_TYPES.WEEKLY_REPORT:
      return [
        { actor: 'parent', channel: 'email',    emailTemplateId: 'PARENT_WEEKLY_REPORT' },
        { actor: 'parent', channel: 'whatsapp', waTemplateId:    'WEEKLY_DIGEST'        },
      ];

    case NOTIFICATION_EVENT_TYPES.MONTHLY_REPORT:
      return [
        { actor: 'parent', channel: 'email', emailTemplateId: 'PARENT_MONTHLY_REPORT' },
      ];

    case NOTIFICATION_EVENT_TYPES.TRIAL_ENDING:
      return [
        { actor: 'parent', channel: 'whatsapp', waTemplateId:    'PARENT_TRIAL_ENDING' },
        { actor: 'parent', channel: 'email',    emailTemplateId: 'PARENT_TRIAL_ENDING' },
      ];

    case NOTIFICATION_EVENT_TYPES.TRIAL_ENDED:
      return [
        { actor: 'parent', channel: 'email', emailTemplateId: 'PARENT_TRIAL_ENDED' },
      ];

    case NOTIFICATION_EVENT_TYPES.PAYMENT_SUCCESS:
      return [
        { actor: 'parent', channel: 'email',    emailTemplateId: 'PARENT_PAYMENT_SUCCESS' },
        { actor: 'parent', channel: 'whatsapp', waTemplateId:    'PARENT_PAYMENT_SUCCESS'  },
      ];

    case NOTIFICATION_EVENT_TYPES.PAYMENT_FAILED:
      return [
        { actor: 'parent', channel: 'whatsapp', waTemplateId:    'PARENT_PAYMENT_FAILED' },
        { actor: 'parent', channel: 'email',    emailTemplateId: 'PARENT_PAYMENT_FAILED' },
      ];

    case NOTIFICATION_EVENT_TYPES.SECURITY_ALERT:
      return [
        { actor: 'student', channel: 'email', emailTemplateId: 'STUDENT_SECURITY_ALERT' },
        { actor: 'parent',  channel: 'email', emailTemplateId: 'PARENT_SECURITY_ALERT'  },
        { actor: 'parent',  channel: 'whatsapp', waTemplateId: 'ADMIN_CUSTOM'           },
      ];

    case NOTIFICATION_EVENT_TYPES.NEW_DEVICE_LOGIN:
      return [
        { actor: 'student', channel: 'email', emailTemplateId: 'STUDENT_NEW_DEVICE_LOGIN' },
        { actor: 'parent',  channel: 'email', emailTemplateId: 'PARENT_NEW_DEVICE_LOGIN'  },
      ];

    default:
      return [];
  }
}

// ── Contact resolution ────────────────────────────────────────────────────────

interface ContactInfo {
  studentEmail?: string;
  studentWhatsapp?: string;
  studentName?: string;
  parentEmail?: string;
  parentWhatsapp?: string;
  parentName?: string;
}

async function resolveContacts(studentId: string, parentId?: string): Promise<ContactInfo> {
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    select: { name: true, email: true, whatsappPhone: true, parentPhone: true },
  });

  let parentEmail: string | undefined;
  let parentWhatsapp: string | undefined;
  let parentName: string | undefined;

  // Resolve parent contact: prefer explicit parentId, fall back to student.parentEmail
  if (parentId) {
    try {
      const parent = await prisma.user.findUnique({
        where: { id: parentId },
        select: { name: true, email: true, whatsappPhone: true, parentPhone: true },
      });
      if (parent) {
        parentEmail    = parent.email ?? undefined;
        parentWhatsapp = (parent.whatsappPhone ?? parent.parentPhone) ?? undefined;
        parentName     = parent.name ?? undefined;
      }
    } catch (err) {
      logger.warn('[notifications] parent contact resolution failed', { parentId, error: String(err) });
    }
  } else if (student) {
    // Legacy path: student record carries parent contact
    const s = await prisma.user.findUnique({
      where: { id: studentId },
      select: { parentEmail: true, whatsappPhone: true, parentPhone: true },
    });
    parentEmail    = s?.parentEmail ?? undefined;
    parentWhatsapp = (s?.whatsappPhone ?? s?.parentPhone) ?? undefined;
  }

  return {
    studentEmail:    student?.email ?? undefined,
    studentWhatsapp: (student?.whatsappPhone ?? student?.parentPhone) ?? undefined,
    studentName:     student?.name ?? undefined,
    parentEmail,
    parentWhatsapp,
    parentName,
  };
}

// ── Mark escalation status ────────────────────────────────────────────────────

async function markEscalationStatus(studentId: string, status: string | null): Promise<void> {
  try {
    await prisma.studentEngagementStats.updateMany({
      where: { studentId },
      data:  { escalationStatus: status },
    });
  } catch (err) {
    logger.warn('[notifications] escalationStatus update failed', { studentId, error: String(err) });
  }
}

function buildAuditMetadata(context: NotificationEvent['context']): Record<string, string | number | boolean> {
  const metadata: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(context)) {
    if (value === undefined) continue;
    metadata[key] = value;
  }

  return metadata;
}

// ── Audit log ─────────────────────────────────────────────────────────────────

/**
 * Write one audit row to NotificationAudit for every channel attempt.
 */
export async function logNotificationEvent(
  event: NotificationEvent,
  result: RoutingResult,
): Promise<void> {
  if (result.channels.length === 0) return;

  await Promise.allSettled(
    result.channels.map(async (ch) => {
      try {
        await prisma.notificationAudit.create({
          data: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma enum requires runtime value
            eventType:    event.eventType as any,
            templateId:   ch.templateId || event.eventType,
            recipientId:  ch.actor === 'student' ? event.studentId : (event.parentId ?? event.studentId),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma enum requires runtime value
            channel:      ch.channel.toUpperCase() as any,
            status:       ch.status,
            errorMessage: ch.error ?? null,
            dryRun:       event.dryRun ?? false,
            studentId:    event.studentId,
            parentId:     event.parentId ?? null,
            metadata:     buildAuditMetadata(event.context),
          },
        });
      } catch (err) {
        logger.warn('[notifications] audit log failed', { eventType: event.eventType, channel: ch.channel, error: String(err) });
      }
    }),
  );
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validate a NotificationEvent before routing.
 * Returns array of ValidationError; empty array means valid.
 */
export function validateNotificationEvent(event: NotificationEvent): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!event.studentId) {
    errors.push({ field: 'studentId', message: 'studentId is required' });
  }

  const validEventTypes = new Set<string>(Object.values(NOTIFICATION_EVENT_TYPES));
  if (!validEventTypes.has(event.eventType)) {
    errors.push({ field: 'eventType', message: `Unknown eventType: ${event.eventType}` });
  }

  const validSeverities: NotificationSeverity[] = ['INFORMATIONAL', 'IMPORTANT', 'CRITICAL'];
  if (!validSeverities.includes(event.severity)) {
    errors.push({ field: 'severity', message: `Invalid severity: ${event.severity}` });
  }

  if (typeof event.context !== 'object' || event.context === null) {
    errors.push({ field: 'context', message: 'context must be a plain object' });
  }

  return errors;
}

// ── Main router ───────────────────────────────────────────────────────────────

/**
 * Route a notification event to the appropriate channel(s).
 * Enforces per-actor per-channel frequency caps.
 * Writes a NotificationAudit row for every attempt.
 * Handles side-effects (escalationStatus) as needed.
 *
 * @param event - The notification event to route
 * @returns RoutingResult with per-channel outcomes
 */
export async function routeNotification(event: NotificationEvent): Promise<RoutingResult> {
  const validationErrors = validateNotificationEvent(event);
  if (validationErrors.length > 0) {
    logger.warn('[notifications] invalid event -- skipped', { eventType: event.eventType, errors: validationErrors });
    return { eventType: event.eventType, channels: [], skippedDryRun: false };
  }

  const routes = getRoutes(event.eventType);
  if (routes.length === 0) {
    logger.info('[notifications] no routes for event', { eventType: event.eventType });
    return { eventType: event.eventType, channels: [], skippedDryRun: false };
  }

  let contacts: ContactInfo;
  try {
    contacts = await resolveContacts(event.studentId, event.parentId);
  } catch (err) {
    logger.error('[notifications] contact resolution failed', { studentId: event.studentId, error: String(err) });
    return { eventType: event.eventType, channels: [], skippedDryRun: false };
  }

  // Side-effect: mark escalation status for critical disengagement
  if (event.eventType === NOTIFICATION_EVENT_TYPES.DISENGAGED_CRITICAL && !event.dryRun) {
    await markEscalationStatus(event.studentId, 'CRITICAL');
  }

  const ctx = {
    studentName: contacts.studentName ?? 'there',
    parentName:  contacts.parentName ?? 'there',
    dashboardUrl: event.context.dashboardUrl as string | undefined ?? 'https://spinzyacademy.com/dashboard',
    ...event.context,
  };

  const channelResults: ChannelResult[] = [];

  for (const route of routes) {
    // Resolve contact address for this actor + channel
    const address = resolveAddress(route.actor, route.channel, contacts);

    // In-app and push are not dispatched by this service (handled client-side / FCM)
    if (route.channel === 'in_app' || route.channel === 'push') {
      channelResults.push({
        channel:    route.channel,
        actor:      route.actor,
        templateId: route.emailTemplateId ?? route.waTemplateId ?? '',
        status:     event.dryRun ? 'dry_run' : 'sent',
      });
      continue;
    }

    if (!address) {
      channelResults.push({
        channel:    route.channel,
        actor:      route.actor,
        templateId: route.emailTemplateId ?? route.waTemplateId ?? '',
        status:     'no_contact',
      });
      continue;
    }

    const actorId = route.actor === 'student' ? event.studentId : (event.parentId ?? event.studentId);

    // Cap check
    const cap = await checkAndIncrementCap(actorId, route.actor, route.channel, event.severity);
    if (!cap.allowed) {
      channelResults.push({
        channel:    route.channel,
        actor:      route.actor,
        templateId: route.emailTemplateId ?? route.waTemplateId ?? '',
        status:     'capped',
        error:      cap.reason,
      });
      continue;
    }

    if (event.dryRun) {
      channelResults.push({
        channel:    route.channel,
        actor:      route.actor,
        templateId: route.emailTemplateId ?? route.waTemplateId ?? '',
        status:     'dry_run',
      });
      continue;
    }

    // Dispatch
    let result: ChannelResult;
    if (route.channel === 'email' && route.emailTemplateId) {
      result = await dispatchEmail(route.emailTemplateId, address, ctx, route.actor, route.channel);
    } else if (route.channel === 'whatsapp' && route.waTemplateId) {
      result = await dispatchWhatsApp(route.waTemplateId, address, ctx, event.eventType, route.actor, route.channel);
    } else {
      result = {
        channel:    route.channel,
        actor:      route.actor,
        templateId: route.emailTemplateId ?? route.waTemplateId ?? '',
        status:     'no_contact',
        error:      'no template configured',
      };
    }

    channelResults.push(result);
  }

  const routingResult: RoutingResult = {
    eventType:      event.eventType,
    channels:       channelResults,
    skippedDryRun:  event.dryRun ?? false,
  };

  await logNotificationEvent(event, routingResult);
  return routingResult;
}

// ── Channel dispatch helpers ──────────────────────────────────────────────────

function resolveAddress(
  actor: NotificationActor,
  channel: NotificationChannel,
  contacts: ContactInfo,
): string | undefined {
  if (actor === 'student') {
    if (channel === 'email')    return contacts.studentEmail;
    if (channel === 'whatsapp') return contacts.studentWhatsapp;
  }
  if (actor === 'parent') {
    if (channel === 'email')    return contacts.parentEmail;
    if (channel === 'whatsapp') return contacts.parentWhatsapp;
  }
  return undefined;
}

async function dispatchEmail(
  templateId: string,
  to: string,
  ctx: Record<string, string | number | boolean | undefined>,
  actor: NotificationActor,
  channel: NotificationChannel,
): Promise<ChannelResult> {
  try {
    const sendResult = await sendEmail(templateId, to, ctx);
    return {
      channel,
      actor,
      templateId,
      status:    sendResult.success ? 'sent' : 'failed',
      error:     sendResult.error,
      messageId: sendResult.messageId,
    };
  } catch (err) {
    return { channel, actor, templateId, status: 'failed', error: String(err) };
  }
}

async function dispatchWhatsApp(
  templateId: string,
  phone: string,
  ctx: Record<string, string | number | boolean | undefined>,
  eventType: NotificationEventType,
  actor: NotificationActor,
  channel: NotificationChannel,
): Promise<ChannelResult> {
  try {
    const waMessage = buildWaMessage(templateId, ctx, eventType);
    if (!waMessage) {
      return { channel, actor, templateId, status: 'failed', error: 'could not build WA message' };
    }
    const sendResult = await sendWhatsApp(templateId, phone, waMessage);
    return {
      channel,
      actor,
      templateId,
      status:    sendResult.success ? 'sent' : 'failed',
      error:     sendResult.error,
      messageId: sendResult.messageId,
    };
  } catch (err) {
    return { channel, actor, templateId, status: 'failed', error: String(err) };
  }
}

function buildWaMessage(
  templateId: string,
  ctx: Record<string, string | number | boolean | undefined>,
  _eventType: NotificationEventType,
): WaTemplateMessage | null {
  const sName = String(ctx.studentName ?? 'there');
  const pName = String(ctx.parentName  ?? 'there');
  const url   = String(ctx.ctaUrl ?? ctx.dashboardUrl ?? 'https://spinzyacademy.com/dashboard');

  switch (templateId) {
    case 'STUDENT_DISENGAGED_CRITICAL':
      return buildStudentDisengagedTemplate(sName, url);
    case 'PARENT_DISENGAGED_CRITICAL':
      return buildParentDisengagedTemplate(pName, sName, Number(ctx.inactiveDays ?? 7), url);
    default:
      // Fallback: build a minimal template message using available context params
      return {
        name:     templateId.toLowerCase().replace(/_/g, '_'),
        language: 'en',
        components: [
          { type: 'body', parameters: [{ type: 'text', text: sName }] },
        ],
      };
  }
}
