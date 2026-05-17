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
 * - 2026-05-17T00:00:00Z | reviewer | update logo URL assertion; add assertions for qualitative
 *   accuracy/mastery labels and absence of raw numeric scores in session-complete parent email
 */

import { welcomeEmailHtml, parentPaymentFailedHtml, sessionCompleteForParentHtml } from '../../../../lib/email/templates';

describe('email templates file sanity', () => {
  test('rendered templates include shared LOGO and FOOTER content', () => {
    const welcome = welcomeEmailHtml('Test Student');
    const failed = parentPaymentFailedHtml({ name: 'Parent', retryUrl: 'https://example.test', supportEmail: undefined });

    // basic sanity
    expect(welcome).toEqual(expect.any(String));
    expect(failed).toEqual(expect.any(String));

    // LOGO is an absolute img URL used across templates
    expect(welcome).toMatch(/https:\/\/spinzyacademy\.com\/logos\/logo-email\.png/);
    expect(failed).toMatch(/You are receiving this because you have a Spinzy Academy account\.|Spinzy Academy -- AI Home Tutor/);
  });

  describe('sessionCompleteForParentHtml -- product rule: no raw numeric scores', () => {
    const BASE_DATA = {
      parentName: 'Parent',
      studentName: 'Arjun',
      topicName: 'Algebra',
      subjectName: 'Maths',
      sessionDate: '1 Jan 2026',
      dashboardUrl: 'https://example.test/dashboard',
    };

    test('shows qualitative label instead of raw accuracy percentage', () => {
      const html = sessionCompleteForParentHtml({ ...BASE_DATA, accuracy: 85 });
      expect(html).toContain('Strong');
      expect(html).not.toMatch(/85%/);
    });

    test('shows Building label for mid-range accuracy', () => {
      const html = sessionCompleteForParentHtml({ ...BASE_DATA, accuracy: 60 });
      expect(html).toContain('Good');
      expect(html).not.toMatch(/60%/);
    });

    test('shows qualitative mastery label instead of raw decimal', () => {
      const html = sessionCompleteForParentHtml({ ...BASE_DATA, masteryAfter: 0.75 });
      expect(html).toContain('Strong');
      expect(html).not.toMatch(/0\.75/);
    });

    test('does not expose raw masteryDelta decimal', () => {
      const html = sessionCompleteForParentHtml({ ...BASE_DATA, masteryAfter: 0.5, masteryDelta: 0.12 });
      expect(html).not.toMatch(/0\.12/);
    });
  });
});
