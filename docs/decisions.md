# Spinzy Academy — Decision Log

## D001 — Resend over SMTP/Nodemailer

Why: Resend provides deliverability analytics, verified domain sending,
and a clean SDK. SMTP requires managing credentials + server config.
Nodemailer has no deliverability guarantees.
Impact: All email via lib/mailer.ts. EMAIL_FROM must use verified
subdomain: send.spinzyacademy.com (not spinzyacademy.com).
Rule: sendMail() throws on failure. sendMailSafe() never throws.

## D002 — Neon PostgreSQL over traditional DB

Why: Serverless, scales to zero, no DB server to maintain on VPS.
pgvector support for RAG embeddings. Prisma integration is seamless.
Impact: Connection pooling via Neon pooler URL. Cold starts on first
query (~800ms) are normal -- shown as amber in health dashboard.
Never use DATABASE_URL without ?sslmode=require.

## D003 — Single VPS over cloud-native

Why: Pre-launch. No revenue. Cloud-native (ECS, Lambda) adds
complexity and cost before product-market fit is confirmed.
Impact: PM2 manages 3 processes. Staging runs on port 3001.
Revisit at 500 paying students.

## D004 — BullMQ + Redis over direct cron

Why: Content generation jobs take 30-60 min. Need retry, backoff,
observability. Cron jobs would timeout or get lost on restart.
Impact: Redis must always run (systemctl enable redis).
maxmemory-policy must be noeviction.
Worker levels: 0=root syllabus, 2=notes, 3=questions.

## D005 — Poll-based reconciler over event cascade

Why: Event cascade is fragile -- one missed event breaks the chain.
Poll-based (5-min cron) is self-healing. Missed cycles auto-recover.
Impact: ai-tutor-scheduler must be running. Max 5-min lag between
pipeline stages. Acceptable for async content generation.

## D006 — SubjectDef relation named 'class' not 'classLevel'

Why: Prisma infers relation name from FK field name. FK is classId
therefore relation is class. Changing the FK would require migration.
Impact: EVERY Prisma query on SubjectDef must use class: {...}
not classLevel: {...}. This is a recurring bug source -- enforce via
CLAUDE.md and grep checks before every PR.

## D007 — User.role = 'user' for students

Why: NextAuth default role is 'user'. Changing it would break
session callbacks and require migration of existing records.
Impact: Never filter students with role:'student'. Always use
role:'user'. Admins use role:'admin'.

## D008 — Lowercase slugs for User.subjects

Why: PostgreSQL array comparison is case-sensitive. 'Mathematics' !=
'mathematics'. Normalising at write time prevents lookup failures.
Impact: Always normalise on save: slug.toLowerCase().replace(/\s+/g,'-')
Fix any existing rows: UPDATE "User" SET subjects = ARRAY(SELECT
lower(unnest(subjects))) WHERE subjects IS NOT NULL.

## D009 — DPDP age threshold = 13

Why: India's DPDP Act 2023 defines minor as age < 18 for consent
but platform-specific threshold is 13 (aligns with COPPA/global norm).
Impact: Parent email required only when age < 13.
requiresParentOTPGate() must check BOTH accountStatus AND age < 13.

## D010 — GPT fallback when NCERT chunks missing

Why: NCERT scraper requires tsx + network access. Content generation
should not block on scraper completion. GPT knowledge is acceptable
for chapter structure; NCERT is preferred for accuracy.
Impact: SyllabusWorker logs warn when falling back. Run NCERT scraper
before HydrateAll for production-quality content.
Priority: Gr10 > Gr9 > Gr8 > Gr6 > Gr11/12.

## D011 — HydrationJob hierarchy levels 0/2/3 not 0/1/2

Why: Legacy implementation uses 2 and 3 for child jobs. Changing
numbering would orphan existing jobs in DB.
Impact: Do not renumber. Document clearly. Level 0=root syllabus,
Level 2=notes per topic, Level 3=questions per note.
Cascade driven by reconciler poll, not event-driven.

## D012 — Diagnostic never redirects to dashboard

Why: Silent redirect confuses students. They don't know why they
left the diagnostic. "Vidya is getting ready" is honest and actionable.
Impact: topicCount === 0 shows inline waiting card.
generateSubjectDiagnosticTest() failure shows same card.
Dashboard redirect is only valid for auth failures.
