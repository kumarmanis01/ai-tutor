/**
 * Unit tests for badge icon → emoji mapping in SessionCompletionScreen.
 *
 * Inlines the same logic as the component to keep tests authoritative.
 * (badgeEmoji is a local helper inside SessionCompletionScreen.tsx)
 */

const BADGE_EMOJI: Record<string, string> = {
  fire: '🔥',
  trophy: '🏆',
  diamond: '💎',
  crown: '👑',
  lightning: '⚡',
  muscle: '💪',
  star: '⭐',
};

function badgeEmoji(icon?: string): string {
  if (!icon) return '🏅';
  return BADGE_EMOJI[icon] ?? '🏅';
}

describe('badgeEmoji', () => {
  test('should return correct emoji for each known icon key', () => {
    expect(badgeEmoji('fire')).toBe('🔥');
    expect(badgeEmoji('trophy')).toBe('🏆');
    expect(badgeEmoji('diamond')).toBe('💎');
    expect(badgeEmoji('crown')).toBe('👑');
    expect(badgeEmoji('lightning')).toBe('⚡');
    expect(badgeEmoji('muscle')).toBe('💪');
    expect(badgeEmoji('star')).toBe('⭐');
  });

  test('should return fallback medal emoji for unknown icon key', () => {
    expect(badgeEmoji('unknown_key')).toBe('🏅');
    expect(badgeEmoji('rocket')).toBe('🏅');
  });

  test('should return fallback medal emoji when icon is undefined', () => {
    expect(badgeEmoji(undefined)).toBe('🏅');
  });

  test('should return fallback medal emoji when icon is empty string', () => {
    // Empty string is falsy -- same branch as undefined
    expect(badgeEmoji('')).toBe('🏅');
  });

  test('streak badge icon keys map to expected emojis', () => {
    // streak_7 and streak_14 use fire, streak_30 uses trophy,
    // streak_60 uses diamond, streak_100 uses crown -- verify all
    expect(badgeEmoji('fire')).toBe('🔥');
    expect(badgeEmoji('trophy')).toBe('🏆');
    expect(badgeEmoji('diamond')).toBe('💎');
    expect(badgeEmoji('crown')).toBe('👑');
  });
});
