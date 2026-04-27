/**
 * FILE OBJECTIVE:
 * - Unit tests for faq-data.ts: verifies v3 FAQ list shape, count, and content.
 *
 * LINKED UNIT TEST: this file is the test
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T00:00:00Z | copilot | v3 FAQ update: replace test assertions for v3 questions
 */
import { getFAQs, type FAQ } from '@/app/(public)/landing-page/components/faq-data';

describe('getFAQs', () => {
  let faqs: FAQ[];

  beforeEach(() => {
    faqs = getFAQs();
  });

  it('should return exactly 8 FAQs', () => {
    expect(faqs).toHaveLength(8);
  });

  it('should have unique numeric ids from 1 to 8', () => {
    const ids = faqs.map((f) => f.id);
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('each FAQ should have non-empty questionEn, questionHi, answerEn, answerHi, category', () => {
    faqs.forEach((faq) => {
      expect(faq.questionEn.trim().length).toBeGreaterThan(0);
      expect(faq.questionHi.trim().length).toBeGreaterThan(0);
      expect(faq.answerEn.trim().length).toBeGreaterThan(0);
      expect(faq.answerHi.trim().length).toBeGreaterThan(0);
      expect(faq.category.trim().length).toBeGreaterThan(0);
    });
  });

  it('should include board coverage question (Coverage category)', () => {
    const board = faqs.find((f) => f.category === 'Coverage');
    expect(board).toBeDefined();
    expect(board?.questionEn.toLowerCase()).toMatch(/cbse|icse|board/);
  });

  it('should include a Pricing category FAQ about free trial', () => {
    const pricing = faqs.filter((f) => f.category === 'Pricing');
    expect(pricing.length).toBeGreaterThanOrEqual(1);
    const trial = pricing.find((f) => f.questionEn.toLowerCase().includes('free'));
    expect(trial).toBeDefined();
  });

  it('should include a Privacy FAQ about data safety', () => {
    const privacy = faqs.find((f) => f.category === 'Privacy');
    expect(privacy).toBeDefined();
    expect(privacy?.answerEn.toLowerCase()).toMatch(/dpdp|data|privacy/);
  });

  it('should include a Schools FAQ', () => {
    const schools = faqs.find((f) => f.category === 'Schools');
    expect(schools).toBeDefined();
    expect(schools?.answerEn).toMatch(/schools@spinzyacademy.com/);
  });

  it('should include a cancel subscription FAQ', () => {
    const cancel = faqs.find((f) => f.questionEn.toLowerCase().includes('cancel'));
    expect(cancel).toBeDefined();
  });

  it('should not contain any smart quotes or em-dashes in English answers', () => {
    const smartQuotePattern = /[\u2018\u2019\u201C\u201D\u2013\u2014]/;
    faqs.forEach((faq) => {
      expect(smartQuotePattern.test(faq.answerEn)).toBe(false);
    });
  });
});
