import fs from 'fs';

describe('exists lib/syllabusGuardrails.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\syllabusGuardrails.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
