import { COSMETIC_ITEMS, eligibleCosmetics } from '@/lib/student/cosmetics';

describe('COSMETIC_ITEMS', () => {
  it('should define one item per streak milestone (7, 14, 30, 60, 100)', () => {
    const milestones = COSMETIC_ITEMS.map((c) => c.streakMilestone).sort((a, b) => a - b);
    expect(milestones).toEqual([7, 14, 30, 60, 100]);
  });

  it('should contain only avatar_frame and profile_theme types', () => {
    const types = new Set(COSMETIC_ITEMS.map((c) => c.type));
    expect([...types].every((t) => t === 'avatar_frame' || t === 'profile_theme')).toBe(true);
  });

  it('should have unique keys', () => {
    const keys = COSMETIC_ITEMS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('eligibleCosmetics', () => {
  it('should return [] when streak is 0', () => {
    expect(eligibleCosmetics(0)).toHaveLength(0);
  });

  it('should return only frame_flame when streak is 7', () => {
    const result = eligibleCosmetics(7);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('frame_flame');
  });

  it('should return all 5 items when streak is 100', () => {
    expect(eligibleCosmetics(100)).toHaveLength(5);
  });

  it('should return 4 items when streak is 60', () => {
    expect(eligibleCosmetics(60)).toHaveLength(4);
  });

  it('should return nothing when streak is 6 (below first milestone)', () => {
    expect(eligibleCosmetics(6)).toHaveLength(0);
  });

  it('should include items at exact milestone boundaries', () => {
    const keys14 = eligibleCosmetics(14).map((c) => c.key);
    expect(keys14).toContain('frame_flame');
    expect(keys14).toContain('theme_indigo');
    expect(keys14).not.toContain('frame_trophy');
  });
});
