import fs from 'fs';

describe('exists scripts/seed-ai-content.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\scripts\\seed-ai-content.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
