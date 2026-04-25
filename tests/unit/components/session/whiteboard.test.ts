/**
 * Unit tests for F-STU-014 Virtual Whiteboard helpers.
 *
 * Tests the subject activation logic (needsWhiteboard) and the
 * AI step extraction logic used in AITutorSessionShell.
 */

// ── needsWhiteboard ────────────────────────────────────────────────────────────
// Inline the logic here since it lives inside a component file.
// Pattern mirrors AITutorSessionShell.tsx to keep tests authoritative.

const WHITEBOARD_SUBJECTS = new Set([
  'mathematics',
  'maths',
  'math',
  'physics',
  'chemistry',
  'geometry',
  'algebra',
]);

function needsWhiteboard(subjectName: string): boolean {
  return WHITEBOARD_SUBJECTS.has(subjectName.toLowerCase().trim());
}

// ── AI step extraction ─────────────────────────────────────────────────────────

function extractSteps(content: string): string[] {
  return content
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('needsWhiteboard', () => {
  it('should activate for mathematics', () => expect(needsWhiteboard('Mathematics')).toBe(true));
  it('should activate for maths', () => expect(needsWhiteboard('Maths')).toBe(true));
  it('should activate for physics', () => expect(needsWhiteboard('Physics')).toBe(true));
  it('should activate for chemistry', () => expect(needsWhiteboard('Chemistry')).toBe(true));
  it('should activate for geometry', () => expect(needsWhiteboard('geometry')).toBe(true));
  it('should activate for algebra', () => expect(needsWhiteboard('ALGEBRA')).toBe(true));
  it('should NOT activate for history', () => expect(needsWhiteboard('History')).toBe(false));
  it('should NOT activate for english', () => expect(needsWhiteboard('English')).toBe(false));
  it('should NOT activate for empty string', () => expect(needsWhiteboard('')).toBe(false));
  it('should handle leading/trailing whitespace', () =>
    expect(needsWhiteboard('  maths  ')).toBe(true));
});

describe('extractSteps', () => {
  it('should split content into non-empty lines', () => {
    const result = extractSteps('Step 1: Expand\nStep 2: Simplify\nStep 3: Solve');
    expect(result).toEqual(['Step 1: Expand', 'Step 2: Simplify', 'Step 3: Solve']);
  });

  it('should filter out blank lines', () => {
    const result = extractSteps('Line 1\n\nLine 2\n\n');
    expect(result).toEqual(['Line 1', 'Line 2']);
  });

  it('should return empty array for whitespace-only content', () => {
    expect(extractSteps('   \n   ')).toEqual([]);
  });

  it('should handle single-line content', () => {
    expect(extractSteps('Only one step')).toEqual(['Only one step']);
  });
});
