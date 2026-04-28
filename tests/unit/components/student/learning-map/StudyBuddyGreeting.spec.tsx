/**
 * Unit tests for StudyBuddyGreeting component (S2.1 top bar avatar).
 */

describe('StudyBuddyGreeting module', () => {
  it('should import without throwing', () => {
    expect(() => require('@/components/student/learning-map/StudyBuddyGreeting')).not.toThrow();
  });

  it('should export default and named export', () => {
    const mod = require('@/components/student/learning-map/StudyBuddyGreeting');
    expect(typeof mod.default).toBe('function');
    expect(typeof mod.StudyBuddyGreeting).toBe('function');
  });
});
