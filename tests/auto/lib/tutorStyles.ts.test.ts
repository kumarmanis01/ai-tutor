import fs from 'fs';

describe('exists lib/tutorStyles.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\tutorStyles.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
