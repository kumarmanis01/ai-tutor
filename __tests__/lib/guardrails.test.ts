import { checkProfanity, enforceStudyContext } from '../../lib/guardrails';

describe('lib/guardrails', () => {
  describe('checkProfanity', () => {
    it('returns true when message contains a banned word (case-insensitive)', () => {
      expect(checkProfanity('This is bullshit')).toBe(true);
      expect(checkProfanity('What a BiTcH move')).toBe(true);
    });

    it('returns false for clean messages', () => {
      expect(checkProfanity('This is a helpful explanation about math')).toBe(false);
    });
  });

  describe('enforceStudyContext', () => {
    it('returns a warning string when message is off-topic', () => {
      const res = enforceStudyContext('Tell me about suicide and how to cope');
      expect(typeof res).toBe('string');
      expect(res).toMatch(/Let's stay focused/i);
    });

    it('returns null for on-topic messages', () => {
      expect(enforceStudyContext('Explain the Pythagorean theorem')).toBeNull();
    });
  });
});
