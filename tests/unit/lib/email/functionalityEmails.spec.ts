/**
 * FILE OBJECTIVE:
 * - Validate canonical functionality-scoped email constants used across runtime modules.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/email/functionalityEmails.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-09T00:00:00Z | copilot | created assertions for centralized email constants
 * - 2026-05-09T00:00:00Z | copilot | renamed test file to functionalityEmails.spec.ts for naming clarity
 */

import {
  AUTH_NO_REPLY_EMAIL,
  CONTACT_US_SUPPORT_EMAIL,
  LANDING_FAQ_SUPPORT_EMAIL,
  LANDING_FOOTER_SUPPORT_EMAIL,
  MAIL_CONSTANTS_NO_REPLY_EMAIL,
  MAILER_NO_REPLY_EMAIL,
  MAILER_TOPIC_RANKER_ALERT_EMAIL,
  NIGHTLY_TEST_REPORT_RECIPIENT_EMAIL,
  PAYMENT_DUNNING_SUPPORT_EMAIL,
  REFUND_SUPPORT_EMAIL,
  RAZORPAY_WEBHOOK_SUPPORT_EMAIL,
  SUBSCRIPTION_RENEWAL_SUPPORT_EMAIL,
} from '@/lib/email/functionalityEmails';

describe('lib/email/functionalityEmails', () => {
  it('should expose support emails as separate functionality keys', () => {
    expect(CONTACT_US_SUPPORT_EMAIL).toBe('support@spinzyacademy.com');
    expect(LANDING_FAQ_SUPPORT_EMAIL).toBe('support@spinzyacademy.com');
    expect(LANDING_FOOTER_SUPPORT_EMAIL).toBe('support@spinzyacademy.com');
    expect(REFUND_SUPPORT_EMAIL).toBe('support@spinzyacademy.com');
    expect(RAZORPAY_WEBHOOK_SUPPORT_EMAIL).toBe('support@spinzyacademy.com');
    expect(PAYMENT_DUNNING_SUPPORT_EMAIL).toBe('support@spinzyacademy.com');
    expect(SUBSCRIPTION_RENEWAL_SUPPORT_EMAIL).toBe('support@spinzyacademy.com');
  });

  it('should expose no-reply emails as separate functionality keys', () => {
    expect(AUTH_NO_REPLY_EMAIL).toBe('no-reply@send.spinzyacademy.com');
    expect(MAILER_NO_REPLY_EMAIL).toBe('no-reply@send.spinzyacademy.com');
    expect(MAIL_CONSTANTS_NO_REPLY_EMAIL).toBe('no-reply@send.spinzyacademy.com');
  });

  it('should expose operation inboxes by functionality', () => {
    expect(MAILER_TOPIC_RANKER_ALERT_EMAIL).toBe('feedback@spinzyacademy.com');
    expect(NIGHTLY_TEST_REPORT_RECIPIENT_EMAIL).toBe('health@spinzyacademy.com');
  });
});
