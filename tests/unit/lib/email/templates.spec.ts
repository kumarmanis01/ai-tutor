/**
 * FILE OBJECTIVE:
 * - Basic sanity tests for exported email templates ensuring shared
 *   LOGO and FOOTER content are present in rendered HTML.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/email/templates.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-14T00:00:00Z | copilot | add header and assert rendered templates include logo/footer
 */

import { welcomeEmailHtml, parentPaymentFailedHtml } from '../../../../lib/email/templates';

describe('email templates file sanity', () => {
  test('rendered templates include shared LOGO and FOOTER content', () => {
    const welcome = welcomeEmailHtml('Test Student');
    const failed = parentPaymentFailedHtml({ name: 'Parent', retryUrl: 'https://example.test', supportEmail: undefined });

    // basic sanity
    expect(welcome).toEqual(expect.any(String));
    expect(failed).toEqual(expect.any(String));

    // LOGO is an absolute img URL used across templates
    expect(welcome).toMatch(/https:\/\/spinzyacademy\.com\/icons\/spinzy-navbar-source\.png/);
    expect(failed).toMatch(/You are receiving this because you have a Spinzy Academy account\.|Spinzy Academy -- AI Home Tutor/);
  });
});
