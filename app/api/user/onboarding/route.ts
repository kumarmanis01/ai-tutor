/**
 * FILE OBJECTIVE:
 * - Persist student onboarding profile fields and trigger onboarding side-effects such as diagnostics bootstrap and parent auto-linking by contact.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/onboarding.grade-immutability.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-12T00:00:00Z | copilot | persist parent_whatsapp to parentWhatsappPhone and set accountStatus lifecycle with requiresOtp response
 * - 2026-05-11T00:00:00Z | copilot | auto-link matching parent accounts using onboarding parent email/whatsapp contacts
 * - 2026-05-13T00:00:00Z | copilot | emit `STUDENT.SUBJECT_SELECTED` analytics when subjects are updated during onboarding (best-effort)
 * - 2026-05-20T00:00:00Z | copilot | refactor: use centralized sendEmailUnifiedSafe (lib/mail), remove direct sendMailSafe per infra policy
 * - 2026-06-06T00:00:00Z | claude | do not downgrade already-verified under-13 accounts on resubmit;
 *     derive accountStatus/requiresOtp from prior parent verification
 */
import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
// Consolidated onboarding handler (merged onboarding-phone -> onboarding)
import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { DPDP_MINOR_AGE } from '@/lib/constants/age';
import { prisma } from '@/lib/prisma';
import { invalidateUserSessionCache } from '@/lib/auth';
import { getDailyTask } from '@/lib/dailyHabit';
import { enqueueDiagnosticBootstrapJob } from '@/jobs/diagnosticBootstrap';
import { enqueueSubjectHydration } from '@/lib/diagnostics/enqueueSubjectHydration';
import { sendEmailUnifiedSafe } from '@/lib/mail';
import { welcomeEmailHtml } from '@/lib/email/templates';
import { generateLearningPlan } from '@/lib/ai/learningPlan';
import { LanguageCode } from '@prisma/client';
import { ensureAutoLinkedParentsForStudent } from '@/lib/parent/contactLinking';
import { ANALYTICS_EVENTS } from '@/lib/analytics/events';
import { emitServerAnalyticsEvent } from '@/lib/analytics/server';

export async function POST(req: NextRequest) {
  const start = Date.now();
  let res: Response;
  try {
    const session = await getServerSessionForHandlers();
    // logApiUsage('/api/user/onboarding', 'POST', session?.user?.id); // replaced by logger.logAPI

    let userId: string | undefined;
    if (session && session.user && session.user.id) {
      userId = session.user.id as string;
    }

    const body = await req.json().catch(() => ({}));
    try {
      const masked = { ...body } as any;
      if (typeof masked.token === 'string') masked.token = `***${String(masked.token).slice(-8)}`;
      if (typeof masked.phone === 'string') masked.phone = String(masked.phone).replace(/\d(?=\d{4})/g, '*');
      if (typeof masked.whatsapp_phone === 'string') masked.whatsapp_phone = String(masked.whatsapp_phone).replace(/\d(?=\d{4})/g, '*');
      logger.info('/api/user/onboarding received payload (masked)', { className: 'api.user.onboarding', methodName: 'POST', masked });
      const debugEnabled = String(process.env.DEBUG_ONBOARDING || '').toLowerCase() === '1' || String(process.env.DEBUG_ONBOARDING || '').toLowerCase() === 'true';
      if (debugEnabled) {
        logger.debug('/api/user/onboarding received payload (RAW)', { className: 'api.user.onboarding', methodName: 'POST', body });
      }
    } catch (logErr) {
      logger.warn('/api/user/onboarding: failed to mask/log payload', { className: 'api.user.onboarding', methodName: 'POST', error: logErr });
      logger.debug('/api/user/onboarding raw payload fallback', { className: 'api.user.onboarding', methodName: 'POST', body });
    }

    const name = typeof body.name === 'string' ? body.name.trim() : undefined;
    const ageRaw = body.age;
    const age =
      typeof ageRaw === 'number' && Number.isFinite(ageRaw) ? Math.trunc(ageRaw) :
      typeof ageRaw === 'string' && ageRaw.trim() !== '' && Number.isFinite(Number(ageRaw)) ? Math.trunc(Number(ageRaw)) :
      undefined;
    const gradeRaw = (typeof body.class_grade === 'number' || typeof body.class_grade === 'string') ? body.class_grade : body.grade;
    const grade = gradeRaw !== undefined && gradeRaw !== null ? String(gradeRaw) : undefined;
    const board = typeof body.board === 'string' ? body.board : undefined;
    // Normalise subject slugs to lowercase to prevent 'Mathematics' vs 'mathematics' mismatch downstream
    const subjects = Array.isArray(body.subjects)
      ? [...new Set((body.subjects as any[]).map((s) => (s == null ? '' : String(s).toLowerCase().replace(/\s+/g, '-'))).filter((s) => s.length > 0))]
      : undefined;
    const preferredLanguage = typeof body.preferred_language === 'string' ? body.preferred_language : undefined;
    const token = typeof body.token === 'string' ? body.token : undefined;
    const rawPhone = typeof body.phone === 'string' ? body.phone.trim() : undefined;
    const phone = rawPhone ? rawPhone.replace(/[^0-9+]/g, '') : undefined;
    const rawWhatsappPhone = typeof body.whatsapp_phone === 'string' ? body.whatsapp_phone.trim() : undefined;
    const whatsappPhone = rawWhatsappPhone ? rawWhatsappPhone.replace(/[^0-9+]/g, '') : undefined;
    const rawParentWhatsapp = typeof body.parent_whatsapp === 'string' ? body.parent_whatsapp.trim() : (typeof body.parentWhatsapp === 'string' ? body.parentWhatsapp.trim() : undefined);
    const parentWhatsappPhone = rawParentWhatsapp ? rawParentWhatsapp.replace(/[^0-9+]/g, '') : undefined;
    const parentEmailRaw = typeof body.parent_email === 'string' ? body.parent_email.trim() : (typeof body.parentEmail === 'string' ? body.parentEmail.trim() : undefined);
    const parentEmail = parentEmailRaw && parentEmailRaw.includes('@') ? parentEmailRaw : undefined;
    const schoolNameRaw = typeof body.school_name === 'string' ? body.school_name.trim() : undefined;
    const schoolName = schoolNameRaw && schoolNameRaw.length > 0 ? schoolNameRaw : undefined;

    // Do not create users in onboarding. If there's no session user id, we will return 401 below.

    if (!userId) {
      res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      logger.logAPI(req, res, { className: 'UserOnboardingAPI', methodName: 'POST' }, start);
      return res;
    }

    // Enforce required fields for onboarding
    const fieldErrors: Record<string, string> = {};
    if (!grade || String(grade).trim() === '') fieldErrors.class_grade = 'Class is required';
    if (!board || String(board).trim() === '') fieldErrors.board = 'Board is required';
    if (!preferredLanguage || String(preferredLanguage).trim() === '') fieldErrors.preferred_language = 'Preferred language is required';
    if (!subjects || subjects.length === 0) fieldErrors.subjects = 'Select at least 1 subject';
    if (subjects && subjects.length > 6) fieldErrors.subjects = 'You can select up to 6 subjects';
    // Validate optional school name: trim already applied above; enforce max length
    if (schoolName && schoolName.length > 120) fieldErrors.school_name = 'School name must be 120 characters or fewer';
    // Parent email is collected in a separate post-onboarding step -- not required here.
    // Under-DPDP_MINOR_AGE handling sets accountStatus below after the DB save.
    if (Object.keys(fieldErrors).length) {
      res = NextResponse.json({ error: 'validation_error', fieldErrors }, { status: 400 });
      logger.logAPI(req, res, { className: 'UserOnboardingAPI', methodName: 'POST' }, start);
      return res;
    }

    // Server-side validation: verify subjects exist for the selected board+grade
    if (subjects && subjects.length > 0 && board && grade) {
      try {
        const validSubjects = await prisma.subjectDef.findMany({
          where: {
            class: {
              board: { slug: { equals: board, mode: 'insensitive' } },
              grade: Number(grade),
            },
            lifecycle: 'active',
          },
          select: { name: true, slug: true },
        });
        // If no SubjectDef rows are seeded for this board+grade, skip validation entirely
        if (validSubjects.length > 0) {
          const valid = new Set<string>();
          for (const s of validSubjects) {
            if (s?.name) {
              valid.add(String(s.name).toLowerCase());
              valid.add(String(s.name)); // exact-case match
            }
            if (s?.slug) {
              valid.add(String(s.slug).toLowerCase());
              valid.add(String(s.slug)); // exact-case match
            }
          }
          const invalid = subjects.filter((s) => !valid.has(s.toLowerCase()) && !valid.has(s));
          if (invalid.length > 0) {
            fieldErrors.subjects = `Invalid subjects for ${board} grade ${grade}: ${invalid.join(', ')}`;
            res = NextResponse.json({ error: 'validation_error', fieldErrors }, { status: 400 });
            logger.logAPI(req, res, { className: 'UserOnboardingAPI', methodName: 'POST' }, start);
            return res;
          }
        }
      } catch (valErr) {
        // Non-blocking: if validation query fails, log and continue
        logger.warn('/api/user/onboarding: subject validation query failed', { className: 'api.user.onboarding', methodName: 'POST', error: valErr });
      }
    }

    const updates: any = {};
    if (name) updates.name = name;
    if (age != null) updates.age = age;
    if (grade) updates.grade = grade;
    if (board) updates.board = board;
    if (subjects) updates.subjects = subjects;
    if (preferredLanguage) updates.language = preferredLanguage;
    if (token) updates.lastWidgetToken = token;
    if (parentEmail !== undefined) updates.parentEmail = parentEmail || null;
    if (schoolName !== undefined) updates.schoolName = schoolName;
    // whatsappPhone is immutable after first save -- only written when not already set (enforced below after DB lookup)

    // Avoid logging user-supplied free-text (school names) in plain logs.
    // Mask schoolName so operator logs don't retain school identifiers.
    const maskedUpdates = { ...updates } as any;
    if (maskedUpdates.schoolName !== undefined) maskedUpdates.schoolName = '***REDACTED***';
    logger.info('/api/user/onboarding userId and updates', { className: 'api.user.onboarding', methodName: 'POST', userId, updates: maskedUpdates });
    let updatedUser: any = null;
    try {
      // First, ensure the user exists; if not, try to resolve via email or phone (without creating)
      const existingById = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, board: true, grade: true, whatsappPhone: true, parentWhatsappPhone: true, subjects: true, parentEmail: true, language: true } });
      if (!existingById) {
        const email = typeof (session?.user as any)?.email === 'string' ? (session!.user as any).email : undefined;
        let resolvedUserId: string | undefined = undefined;
        if (email) {
          const byEmail = await prisma.user.findUnique({ where: { email }, select: { id: true } }).catch(() => null);
          if (byEmail) resolvedUserId = byEmail.id;
        }
        if (!resolvedUserId && phone) {
          const byPhone = await prisma.user.findUnique({ where: { phone }, select: { id: true } }).catch(() => null);
          if (byPhone) resolvedUserId = byPhone.id;
        }
        if (!resolvedUserId) {
          logger.warn('/api/user/onboarding: user not found (no create).', { className: 'api.user.onboarding', methodName: 'POST' });
          res = NextResponse.json({
            error: 'user_not_found',
            message: 'Your account record is missing. Please sign out and sign in again to re-link your account.',
          }, { status: 404 });
          logger.logAPI(req, res, { className: 'UserOnboardingAPI', methodName: 'POST' }, start);
          return res;
        }
        userId = resolvedUserId as string;
      }

      // grade/board immutable after first save -- strip from all PATCH handlers
      const gradeRow = existingById ?? await prisma.user.findUnique({ where: { id: userId }, select: { grade: true, whatsappPhone: true, parentWhatsappPhone: true } }).catch(() => null);
      if (gradeRow?.grade != null) {
        delete updates.grade
      }
      // whatsappPhone immutable after first save -- only write when not already set
      if (whatsappPhone && !(gradeRow as any)?.whatsappPhone) {
        updates.whatsappPhone = whatsappPhone;
      }
      // parentWhatsappPhone is support-managed after initial save -- only write when not already set
      if (parentWhatsappPhone && !(gradeRow as any)?.parentWhatsappPhone) {
        updates.parentWhatsappPhone = parentWhatsappPhone;
      }

      updatedUser = await prisma.user.update({ where: { id: userId }, data: updates });
      await ensureAutoLinkedParentsForStudent({
        prisma,
        studentId: updatedUser.id,
        parentEmail: updatedUser.parentEmail,
        whatsappPhone: updatedUser.parentWhatsappPhone,
      });
      // If the user's board changed, regenerate existing learning plans to match the new board's curriculum.
      try {
        let prevBoard: string | null = null;
        if (existingById && existingById.board != null) {
          prevBoard = existingById.board
        } else {
          try {
            const prev = await prisma.user.findUnique({ where: { id: userId }, select: { board: true } }).catch(() => null)
            prevBoard = prev?.board ?? null
          } catch {
            prevBoard = null
          }
        }
        const newBoard = updatedUser.board ?? null;
        if (prevBoard && newBoard && prevBoard !== newBoard) {
          const lpModel = (prisma as any).learningPlan;
          if (lpModel && typeof lpModel.findMany === 'function') {
            // fetch current plans and regenerate using existing plan params
            lpModel
              .findMany({ where: { studentId: updatedUser.id }, select: { subjectId: true, weeklyGoal: true, examDate: true } })
              .then(async (plans: Array<{ subjectId: string; weeklyGoal: number; examDate?: Date | null }>) => {
                if (!plans || plans.length === 0) return;
                for (const p of plans) {
                  try {
                    await generateLearningPlan(updatedUser.id, p.subjectId, {
                      examDate: p.examDate instanceof Date ? p.examDate : undefined,
                      weeklyGoal: p.weeklyGoal,
                    });
                  } catch (err) {
                    logger.warn('[onboarding] board-change regen failed', { event: 'learning_plan_regen_failed', context: { studentId: updatedUser.id, subjectId: p.subjectId, error: String(err) } });
                  }
                }
              })
              .catch((err: any) => {
                logger.warn('[onboarding] failed to fetch learning plans for board-change regen', { event: 'learning_plan_regen_failed', context: { studentId: updatedUser.id, error: String(err) } });
              });
          }
        }
      } catch (err) {
        logger.warn('[onboarding] board-change regen check failed', { event: 'learning_plan_regen_failed', context: { studentId: updatedUser.id, error: String(err) } });
      }
      logger.info('/api/user/onboarding updated user', { className: 'api.user.onboarding', methodName: 'POST', id: updatedUser.id, name: updatedUser.name, phone: updatedUser.phone });

      // Fire-and-forget: emit subject_selected analytics event when subjects are updated.
      if (subjects && subjects.length > 0) {
        const previousSubjects = Array.isArray(existingById?.subjects) ? existingById.subjects : []
        try {
          void emitServerAnalyticsEvent({
            eventType: ANALYTICS_EVENTS.STUDENT.SUBJECT_SELECTED,
            userId: updatedUser.id,
            metadata: {
              subjects,
              previous_subjects: previousSubjects,
              source: 'onboarding',
            },
          }, 'onboarding');
        } catch {
          // best-effort analytics; swallow errors
        }
      }
    } catch (updErr: any) {
      if (updErr?.code === 'P2022') {
        logger.error('/api/user/onboarding: prisma schema mismatch on update P2022', { className: 'api.user.onboarding', methodName: 'POST', error: updErr });
        res = NextResponse.json({
          error: 'db_schema_mismatch',
          message: 'Database schema is out of sync with Prisma schema: one or more columns (e.g. `User.board`) are missing. Run `npx prisma migrate dev` to apply pending migrations.',
          details: updErr?.meta || String(updErr?.message),
        }, { status: 500 });
        logger.logAPI(req, res, { className: 'UserOnboardingAPI', methodName: 'POST' }, start);
        return res;
      }
      // Handle Neon sleep or admin termination gracefully
      const msg = String(updErr?.message || updErr);
      // Handle record-not-found gracefully (P2025)
      if (updErr?.code === 'P2025' || msg.includes('No record was found for an update')) {
        // Attempt a friendly recovery: create or resolve by phone/email, else return 404 with guidance
        try {
          const email = typeof (session?.user as any)?.email === 'string' ? (session!.user as any).email : undefined;
          // Do NOT create; try to resolve and update only
          let fallbackUserId: string | undefined = undefined;
          if (phone) {
            const byPhone = await prisma.user.findUnique({ where: { phone }, select: { id: true } }).catch(() => null);
            if (byPhone) fallbackUserId = byPhone.id;
          }
          if (!fallbackUserId && email) {
            const byEmail = await prisma.user.findUnique({ where: { email }, select: { id: true } }).catch(() => null);
            if (byEmail) fallbackUserId = byEmail.id;
          }

          if (!fallbackUserId) {
            res = NextResponse.json({
              error: 'user_not_found',
              message: 'We could not find your user record to update. Please re-login to refresh your session.',
            }, { status: 404 });
            logger.logAPI(req, res, { className: 'UserOnboardingAPI', methodName: 'POST' }, start);
            return res;
          }

          updatedUser = await prisma.user.update({ where: { id: fallbackUserId }, data: updates, select: { id: true, name: true, phone: true, board: true, grade: true, welcomeEmailSent: true, parentEmail: true, parentWhatsappPhone: true, whatsappPhone: true, language: true } });
          userId = fallbackUserId;
          logger.info('/api/user/onboarding: updated resolved user after P2025', { className: 'api.user.onboarding', methodName: 'POST', id: updatedUser.id });

          res = NextResponse.json({ ok: true, user: { id: updatedUser.id, name: updatedUser.name, phone: updatedUser.phone } });
          logger.logAPI(req, res, { className: 'UserOnboardingAPI', methodName: 'POST' }, start);
          return res;
        } catch (recoverErr: any) {
          logger.warn('/api/user/onboarding: failed to recover from P2025', { className: 'api.user.onboarding', methodName: 'POST', error: recoverErr });
          res = NextResponse.json({
            error: 'user_not_found',
            message: 'We could not find your user record to update. Please try again or re-login to refresh your session.',
          }, { status: 404 });
          logger.logAPI(req, res, { className: 'UserOnboardingAPI', methodName: 'POST' }, start);
          return res;
        }
      }
      if (msg.includes('terminating connection due to administrator command') || msg.includes('E57P01')) {
        logger.warn('/api/user/onboarding: database temporarily unavailable (Neon sleep)', { className: 'api.user.onboarding', methodName: 'POST' });
        res = new NextResponse(JSON.stringify({ error: 'db_unavailable', message: 'Database temporarily unavailable. Please retry.' }), {
          status: 503,
          headers: { 'Retry-After': '3', 'Content-Type': 'application/json' },
        });
        logger.logAPI(req, res, { className: 'UserOnboardingAPI', methodName: 'POST' }, start);
        return res;
      }
      throw updErr;
    }

    const effectiveAge = updatedUser.age ?? age ?? null;
    const isMinor = typeof effectiveAge === 'number' && effectiveAge < DPDP_MINOR_AGE;

    // Read existing parent verification BEFORE deciding accountStatus so a resubmit
    // of the onboarding form does not downgrade an already-active under-13 account
    // back to pending_parent_verification. Once a parent has verified email or
    // WhatsApp the account stays active across subsequent profile edits.
    const verificationState = await prisma.user.findUnique({
      where: { id: updatedUser.id },
      select: { parentEmailVerifiedAt: true, parentWhatsappVerifiedAt: true },
    });
    const parentAlreadyVerified = !!(
      verificationState?.parentEmailVerifiedAt || verificationState?.parentWhatsappVerifiedAt
    );
    const nextAccountStatus = isMinor && !parentAlreadyVerified ? 'pending_parent_verification' : 'active';
    await prisma.user.update({
      where: { id: updatedUser.id },
      data: { accountStatus: nextAccountStatus },
    });

    const requiresOtp = Boolean(isMinor && !parentAlreadyVerified);

    try {
      if (token) {
        await prisma.event.create({ data: { userId: updatedUser.id, type: 'otp_widget_token', metadata: { token }, timestamp: new Date() } });
      }
    } catch (evErr) {
      logger.warn('/api/user/onboarding: failed to persist widget token as event', { className: 'api.user.onboarding', methodName: 'POST', error: evErr });
    }

    // Trigger initial learning path generation (non-blocking)
    getDailyTask(updatedUser.id).catch((err) => {
      logger.warn('/api/user/onboarding: failed to seed initial daily task', { className: 'api.user.onboarding', methodName: 'POST', error: err });
    });

    // Proactive content seeding + diagnostic bootstrap (both non-blocking).
    //
    // For every selected subject that has no content yet, immediately enqueue
    // a HydrationJob so the content pipeline (syllabus -> notes -> questions)
    // runs in the background. By the time the student navigates to a diagnostic
    // page the content is either ready or nearly ready, avoiding the waiting screen.
    //
    // The diagnostic bootstrap (StudentConceptState seeding) runs only when
    // chapters already exist (it needs curriculum rows to seed against).
    try {
      const gradeNum = Number(grade);
      if (board && Number.isFinite(gradeNum) && subjects && subjects.length > 0) {
        prisma.classLevel.findFirst({
          where: {
            board: { slug: { equals: board, mode: 'insensitive' } },
            grade: gradeNum,
          },
          select: { id: true, boardId: true },
        }).then(async (cl: any) => {
          if (!cl) return;

          const subjectPrefs = new Set(subjects.map((s) => String(s).toLowerCase()));
          const subjectRows = await prisma.subjectDef.findMany({
            where: { classId: cl.id, lifecycle: 'active' },
            select: { id: true, slug: true, name: true },
          });
          const subjectIds = subjectRows
            .filter((s: any) => subjectPrefs.has(String(s.slug).toLowerCase()) || subjectPrefs.has(String(s.name).toLowerCase()))
            .map((s: any) => s.id);
          if (subjectIds.length === 0) return;

          // Proactively enqueue hydration for every subject missing content.
          // enqueueSubjectHydration is idempotent: it skips subjects that already
          // have topics or that already have a pending/running HydrationJob.
          const language: LanguageCode = (updatedUser.language as LanguageCode) ?? LanguageCode.en;
          const hydrationResults = await Promise.allSettled(
            subjectIds.map((subjectId: any) =>
              enqueueSubjectHydration(subjectId, language, 'onboarding'),
            ),
          );
          hydrationResults.forEach((r, i) => {
            if (r.status === 'rejected') {
              logger.warn('[onboarding] failed to enqueue subject hydration', {
                event: 'diagnostic.hydration.onboarding_enqueue_failed',
                context: { studentId: updatedUser.id, subjectId: subjectIds[i], error: String(r.reason) },
              });
            }
          });

          // Diagnostic bootstrap: seeds baseline StudentConceptState rows.
          // Requires chapters to exist, so runs only when the syllabus is already seeded.
          // Isolated try/catch so a bootstrap failure does not mask hydration errors in logs.
          try {
            const chapters = await prisma.chapterDef.findMany({
              where: { subjectId: { in: subjectIds }, lifecycle: 'active' },
              select: { id: true },
            });
            const chapterIds = chapters.map((c: any) => c.id);
            if (chapterIds.length === 0) return;

            await enqueueDiagnosticBootstrapJob({
              studentId: updatedUser.id,
              diagnosticSessionId: `bootstrap:${updatedUser.id}`,
              chapterIds,
              boardId: cl.boardId,
              gradeId: cl.id,
            });
          } catch (bootstrapErr) {
            logger.warn('[onboarding] failed to enqueue diagnostic bootstrap', {
              event: 'diagnostic.bootstrap.enqueue_failed',
              context: { studentId: updatedUser.id, error: String(bootstrapErr) },
            });
          }
        }).catch((err: any) => {
          logger.warn('[onboarding] background content seeding setup failed', {
            event: 'diagnostic.seeding.setup_failed',
            context: { studentId: updatedUser.id, error: String(err) },
          });
        });
      }
    } catch (err) {
      logger.warn('/api/user/onboarding: failed to trigger content seeding', { className: 'api.user.onboarding', methodName: 'POST', error: err });
    }

    // AC-07 (F-STU-003): when subjects change and plans already exist, generate
    // plans for any newly-added subjects that lack one (non-blocking fire-and-forget).
    if (subjects && subjects.length > 0) {
      const finalUserId = updatedUser.id;
      const finalGrade = updatedUser.grade ? Number(updatedUser.grade) : null;
      const finalBoard = updatedUser.board ?? null;
      if (finalGrade && finalBoard) {
        prisma.learningPlan.findMany({
          where: { studentId: finalUserId },
          select: { subjectId: true, examDate: true, weeklyGoal: true },
        }).then(async (existingPlans: any) => {
          if (existingPlans.length === 0) return; // first-time onboarding; generate-plan handles it
          const coveredSubjectIds = new Set(existingPlans.map((p: any) => p.subjectId));
          const normSlugs = subjects.map((s) => String(s).toLowerCase().replace(/\s+/g, '-'));
          const subjectDefs = await prisma.subjectDef.findMany({
            where: {
              slug: { in: normSlugs },
              lifecycle: 'active',
              class: {
                grade: finalGrade,
                board: { slug: { equals: finalBoard, mode: 'insensitive' } },
              },
            },
            select: { id: true },
          });
          const newSubjects = subjectDefs.filter((s: any) => !coveredSubjectIds.has(s.id));
          if (newSubjects.length === 0) return;
          // Use existing plan params from any current plan as defaults
          const ref = existingPlans[0];
          for (const subj of newSubjects) {
            try {
              const planId = await generateLearningPlan(finalUserId, subj.id, {
                examDate: ref.examDate instanceof Date ? ref.examDate : undefined,
                weeklyGoal: ref.weeklyGoal,
              });

              if (planId === null) {
                logger.warn('[onboarding] AC-07: failed to generate plan for new subject', {
                  event: 'learning_plan_subject_regen_failed',
                  context: { studentId: finalUserId, subjectId: subj.id, error: 'generateLearningPlan returned null' },
                });
              }
            } catch (err) {
              logger.warn('[onboarding] AC-07: failed to generate plan for new subject', {
                event: 'learning_plan_subject_regen_failed',
                context: { studentId: finalUserId, subjectId: subj.id, error: String(err) },
              });
            }
          }
        }).catch((err: any) => {
          logger.warn('[onboarding] AC-07: subject regen check failed', {
            event: 'learning_plan_subject_regen_check_failed',
            context: { studentId: finalUserId, error: String(err) },
          });
        });
      }
    }

    // Best-effort: invalidate session cache for this user so jwt callback reloads fresh profile
    try {
      await invalidateUserSessionCache((session?.user as any)?.email);
    } catch (err) {
      logger.warn('UserOnboardingAPI: cache invalidation failed', { className: 'UserOnboardingAPI', methodName: 'POST', error: String(err) });
    }

    // Welcome email: send once after the first onboarding profile save.
    // Centralized email infra: use sendEmailUnifiedSafe (no direct sendMail/sendMailSafe allowed).
    if (!updatedUser.welcomeEmailSent && updatedUser.email) {
      sendEmailUnifiedSafe({
        mode: 'raw',
        delivery: 'best_effort',
        to: updatedUser.email,
        subject: 'Welcome to Spinzy Academy!',
        html: welcomeEmailHtml(updatedUser.name ?? 'there'),
        reason: 'student_onboarding_welcome',
      })
        .then(() =>
          prisma.user.update({
            where: { id: updatedUser.id },
            data: { welcomeEmailSent: true },
          }).catch((e: any) =>
            logger.warn('/api/user/onboarding: failed to set welcomeEmailSent', {
              className: 'api.user.onboarding', methodName: 'POST', error: e,
            }),
          ),
        )
        .catch(() => {
          // sendEmailUnifiedSafe never throws; this catch is defence-in-depth
        });
    }

    res = NextResponse.json({ ok: true, requiresOtp, user: { id: updatedUser.id, name: updatedUser.name, phone: updatedUser.phone } });
    logger.logAPI(req, res, { className: 'UserOnboardingAPI', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.error('/api/user/onboarding error', { className: 'api.user.onboarding', methodName: 'POST', error: err });
    // Provide a clearer error message to avoid confusion for users
    res = NextResponse.json({ error: formatErrorForResponse(err), message: 'Something went wrong while saving your details. Please try again.' }, { status: 500 });
    logger.logAPI(req, res, { className: 'UserOnboardingAPI', methodName: 'POST' }, start);
    return res;
  }
}
