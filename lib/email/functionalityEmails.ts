/**
 * FILE OBJECTIVE:
 * - Canonical functionality-scoped email constants used across runtime code,
 *   UI, workers, and tests to avoid repeated raw literals and enable
 *   independent future changes per feature.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/email/constants.spec.ts
 * - tests/unit/lib/email/functionalityEmails.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-09T00:00:00Z | copilot | created centralized email address constants
 * - 2026-05-09T00:00:00Z | copilot | split into functionality-specific keys even when email values are identical
 * - 2026-05-09T00:00:00Z | copilot | renamed constants module to functionalityEmails for clearer intent
 */

export const CONTACT_US_SUPPORT_EMAIL = 'support@spinzyacademy.com';
export const LANDING_FAQ_SUPPORT_EMAIL = 'support@spinzyacademy.com';
export const LANDING_FOOTER_SUPPORT_EMAIL = 'support@spinzyacademy.com';
export const REFUND_SUPPORT_EMAIL = 'support@spinzyacademy.com';
export const RAZORPAY_WEBHOOK_SUPPORT_EMAIL = 'support@spinzyacademy.com';
export const PAYMENT_DUNNING_SUPPORT_EMAIL = 'support@spinzyacademy.com';
export const SUBSCRIPTION_RENEWAL_SUPPORT_EMAIL = 'support@spinzyacademy.com';
export const MAIL_CONSTANTS_SUPPORT_EMAIL = 'support@spinzyacademy.com';

export const MAILER_NO_REPLY_EMAIL = 'no-reply@send.spinzyacademy.com';
export const AUTH_NO_REPLY_EMAIL = 'no-reply@send.spinzyacademy.com';
export const MAIL_CONSTANTS_NO_REPLY_EMAIL = 'no-reply@send.spinzyacademy.com';

export const MAILER_TOPIC_RANKER_ALERT_EMAIL = 'feedback@spinzyacademy.com';
export const NIGHTLY_TEST_REPORT_RECIPIENT_EMAIL = 'health@spinzyacademy.com';
export const TEMPLATES_LEGACY_SUPPORT_EMAIL = 'support@spinzyacademy.com';
export const BRAND_SUPPORT_EMAIL = 'support@spinzyacademy.com';
export const UPGRADE_FLOW_SUPPORT_EMAIL = 'support@spinzyacademy.com';
export const CONTENT_JOB_ADMIN_ALERT_EMAIL = 'oncall@spinzyacademy.com';
export const PRACTICE_HYDRATION_ALERT_EMAIL = 'spinzydigital@gmail.com';
export const HYDRATION_GENERATION_REPORT_EMAIL = 'feedback@spinzyacademy.com';
