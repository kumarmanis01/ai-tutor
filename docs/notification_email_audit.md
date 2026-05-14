<!--
FILE OBJECTIVE:
- Audit all code locations that originate email and WhatsApp notifications (student, parent, admin).

LINKED UNIT TEST:
- tests/unit/docs/notification_email_audit.spec.ts (suggested)

COPILOT INSTRUCTIONS FOLLOWED:
- /docs/ENGINEERING_PRACTICES.md
- .github/copilot-instructions.md

EDIT LOG:
- 2026-05-14T00:00:00Z | copilot | initial audit of email/WhatsApp senders and templates
-->

# Notification Email & WhatsApp Audit

Date: 2026-05-14

Summary
- Scope: searched repository for transactional and broadcast email/WhatsApp send sites (`sendMailSafe`, `sendMail`, `sendEmail`, `sendWhatsApp*`).
- Goal: determine whether messages are produced using the centralized templates and whether they follow the required email structure (header/logo, greeting, short paragraphs, single CTA button, footer + unsubscribe/support).

Methodology
- Used repository search for mailer/send calls and inspected representative files.
- Focused on call sites that actually compose `html` or call the template layer.

High-level findings
- Centralized template sources that follow the required structure:
  - `lib/email/templates.ts` — comprehensive HTML templates with header (logo), greeting, CTA button and footer (GOOD).
  - `lib/mail.ts` — centralized template catalog (`EMAIL_TEMPLATES`) and `sendEmail()` helper (GOOD when used).
- Provider/wrapper:
  - `lib/mailer.ts` — Resend provider wrapper and safe send helper (ok; operational piece, not a content template).

- Non-compliant sites (compose inline HTML or plain snippets instead of using the centralized templates):
  - `app/api/admin/notifications/trigger-pending-diagnostics/route.ts` — sends `html: \`<p>${body}</p>\`` (NO: lacks header, CTA, footer).
  - `app/api/referral/redeem/route.ts` — several post-transaction best-effort emails use inline `<p>...</p>` snippets (NO: ad-hoc copy, no template wrap).
  - `app/api/razorpay/webhook/route.ts` — payment failed handler composes inline HTML (NO).
  - `worker/services/paymentDunningWorker.ts` — multiple inline HTML messages for dunning and grace emails (NO).
  - `worker/services/*.ts` (paymentDunningWorker, subscriptionRenewalWorker, installmentDunningWorker, etc.) — many workers call `sendMailSafe({ html: '<p>...</p>' })` with inline markup (PARTIAL/NO).
  - Misc ad-hoc sends: `app/api/referral/*`, some `app/api/*` webhook or transactional flows, and a few places that call `sendMailSafe` with a brief HTML fragment instead of using `lib/email/templates.ts` or `lib/mail.ts` (PARTIAL/NO).

Compliant / Good usage examples
- `app/api/user/onboarding/route.ts` — uses `welcomeEmailHtml` from `lib/email/templates.ts` (GOOD).
- `app/api/admin/notifications/broadcast/route.ts` and `send/route.ts` — use `adminBroadcastEmailHtml` (GOOD).
- `app/api/admin/notifications/broadcast-digest/route.ts` — uses `weeklyDigestHtml` (GOOD).
- `lib/notifications.ts` and `lib/mail.ts` — centralized routing and template dispatch (GOOD when consumed).

Detailed file-by-file notes (representative)
- lib/email/templates.ts — Central template catalog. Templates include: header/logo, greeting, CTA button and footer with unsubscribe/support. Meets the requested core email structure. (ACTION: Keep as single source-of-truth)

- lib/mail.ts — Centralized email template catalog and `sendEmail()` wrapper. When code calls `sendEmail(templateId, to, ctx)` messages are built according to the required structure. (ACTION: Encourage all callers to use `sendEmail`.)

- lib/mailer.ts — Resend provider wrapper and `sendMailSafe`. Operational; not a content authoring location. (ACTION: No change; do not add templates here.)

- app/api/admin/notifications/trigger-pending-diagnostics/route.ts — builds `title`/`body` and then does `sendMailSafe({ to, subject: title, html: `<p>${body}</p>` })` for each target. This produces plain fragment emails without header/logo/CTA/footer. (COMPLIANCE: NO)
  - Recommendation: replace this ad-hoc send with `sendMailSafe({ to, subject: title, html: adminBroadcastEmailHtml({ title, body, ctaUrl }) })` or call `sendEmail('ADMIN_CUSTOM' or similar template)` so the message is wrapped in brand template.

- app/api/referral/redeem/route.ts — on fraud/void cases sends short inline `<p>Hi...,</p>` fragments. (COMPLIANCE: NO)
  - Recommendation: create a `REFERRAL_VOIDED` template in `lib/email/templates.ts` (or reuse `adminBroadcastEmailHtml`) and send via `sendMailSafe` with that template.

- app/api/razorpay/webhook/route.ts — Compose `html = '<p>Hi ...</p><p>We couldn\'t complete your recent payment...<a href>Update payment</a>...</p>'`. (COMPLIANCE: NO)
  - Recommendation: add `PARENT_PAYMENT_FAILED` template (exists in `lib/email/templates.ts` as `paymentReceiptHtml` or similar) or reuse `PARENT_PAYMENT_FAILED` from `lib/email/templates.ts`/`lib/mail.ts` and call via the template helper so messages include CTA and footer.

- worker/services/paymentDunningWorker.ts and related workers — multiple inline HTML bodies for reminder, grace, success, expired flows. (COMPLIANCE: PARTIAL/NO)
  - Recommendation: refactor workers to call `sendEmail(templateId, to, ctx)` or at minimum call the corresponding `weeklyDigestHtml`/`paymentReceiptHtml` helpers from `lib/email/templates.ts`. Avoid ad-hoc inline HTML composition.

- app/api/admin/notifications/broadcast and send endpoints — wrap admin messages using `adminBroadcastEmailHtml` (COMPLIANCE: YES).

- app/api/user/onboarding/route.ts — uses `welcomeEmailHtml` (COMPLIANCE: YES).

Overall assessment
- There is a correct, central template layer (`lib/email/templates.ts`) and a centralized template dispatch layer (`lib/mail.ts`). Many important flows already use these (onboarding, admin broadcasts, weekly digest), but a number of legacy or operational flows (webhooks, workers, small post-transaction notifications, and some referral paths) still compose ad-hoc HTML fragments.

Risks
- Ad-hoc HTML sends result in inconsistent branding, lack of unsubscribe/footer, missing support links, and potentially poor mobile/WhatsApp parity. This creates a poor user experience and violates the requirement that all email templates are served from one place.

Recommendations (next steps)
1. Immediate (low-effort)
   - Replace small ad-hoc sends (e.g., `trigger-pending-diagnostics`) with calls to `adminBroadcastEmailHtml` or a new dedicated template that wraps the message. This is a 1-file fix and will standardize formatting quickly.
2. Short-term (developer sprint)
   - Add missing templates to `lib/email/templates.ts` for common ad-hoc cases found (e.g., `REFERRAL_VOIDED`, `PARENT_PAYMENT_FAILED`, `PAYMENT_RETRY_REMINDER`, `GRACE_PERIOD_STARTED`).
   - Update workers and webhook handlers to call `sendEmail(templateId, to, ctx)` or import the HTML template helper instead of composing inline HTML strings.
3. Medium-term (process)
   - Add a lint rule or code-owner PR check for any direct `sendMailSafe({ html:` usage that doesn't reference `lib/email/templates.ts` or call `sendEmail()`.
   - Create unit tests that assert presence of header/logo and footer in rendered templates (tests exist for `lib/mail.ts`, extend to new templates).

Appendix — Representative call sites (non-exhaustive)
- app/api/admin/notifications/trigger-pending-diagnostics/route.ts (inline fragment) — NO
- app/api/referral/redeem/route.ts (inline fragments) — NO
- app/api/razorpay/webhook/route.ts (payment failed HTML) — NO
- worker/services/paymentDunningWorker.ts (multiple inline sends) — PARTIAL/NO
- worker/services/subscriptionRenewalWorker.ts (uses sendMailSafe with basic html) — PARTIAL/NO
- app/api/admin/notifications/broadcast/route.ts — uses `adminBroadcastEmailHtml` (YES)
- app/api/admin/notifications/send/route.ts — uses `adminBroadcastEmailHtml` (YES)
- app/api/admin/notifications/broadcast-digest/route.ts — uses `weeklyDigestHtml` (YES)
- app/api/user/onboarding/route.ts — uses `welcomeEmailHtml` (YES)
- lib/mail.ts — central template dispatch (YES)
- lib/mailer.ts — provider wrapper (RESEND) (OP)

If you want, I can now:
- (A) create a short PR that replaces `trigger-pending-diagnostics` ad-hoc send with a wrapped template (small, quick win), or
- (B) prepare a prioritized list of templates to add and implement one (e.g., `REFERRAL_VOIDED`), or
- (C) run a repository grep to produce an exhaustive CSV of all send sites for tracking.

Choose next step: `A`, `B`, or `C`.
