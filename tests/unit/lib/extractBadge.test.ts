import { extractBadges } from '@/lib/extractBadge';

describe('extractBadges', () => {
  test('should return empty array for null input', () => {
    expect(extractBadges(null)).toEqual([]);
  });

  test('should return empty array for non-object input', () => {
    expect(extractBadges('string')).toEqual([]);
    expect(extractBadges(42)).toEqual([]);
  });

  test('should return empty array when no badges or userBadges field', () => {
    expect(extractBadges({ id: '1', name: 'Test' })).toEqual([]);
  });

  test('should extract from userBadges with nested badge object', () => {
    const profile = {
      userBadges: [
        {
          id: 'ub1',
          badgeKey: 'streak_7',
          badge: {
            id: 'b1',
            name: '7-Day Streak',
            description: '7 consecutive days',
            icon: 'fire',
          },
        },
      ],
    };
    const result = extractBadges(profile);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 'b1',
      name: '7-Day Streak',
      description: '7 consecutive days',
      icon: 'fire',
    });
  });

  test('should extract from flat badges array', () => {
    const profile = {
      badges: [
        { id: 'b1', name: 'Chapter Master', description: 'Mastered a chapter', icon: 'star' },
      ],
    };
    const result = extractBadges(profile);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Chapter Master');
  });

  test('should prefer userBadges over badges when both present', () => {
    const profile = {
      userBadges: [
        { id: 'ub1', badge: { id: 'b1', name: 'From userBadges', description: 'A', icon: 'fire' } },
      ],
      badges: [{ id: 'b2', name: 'From badges', description: 'B', icon: 'star' }],
    };
    const result = extractBadges(profile);
    expect(result[0].name).toBe('From userBadges');
  });

  test('should fall back to top-level fields when badge nested object is absent', () => {
    const profile = {
      userBadges: [
        { id: 'ub1', name: 'Consistency', description: 'Flat badge', icon: 'lightning' },
      ],
    };
    const result = extractBadges(profile);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Consistency');
    expect(result[0].id).toBe('ub1');
  });

  test('should return empty array for empty userBadges array', () => {
    expect(extractBadges({ userBadges: [] })).toEqual([]);
  });

  test('should handle multiple badges correctly', () => {
    const profile = {
      userBadges: [
        { id: 'ub1', badge: { id: 'b1', name: 'Streak 7', description: '7 days', icon: 'fire' } },
        {
          id: 'ub2',
          badge: { id: 'b2', name: 'Chapter Master', description: 'Mastery', icon: 'star' },
        },
      ],
    };
    const result = extractBadges(profile);
    expect(result).toHaveLength(2);
    expect(result.map((b) => b.name)).toEqual(['Streak 7', 'Chapter Master']);
  });
});
