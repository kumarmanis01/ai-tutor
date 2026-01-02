import fs from 'fs';

describe('exists scripts/clear-auth-tables.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\scripts\\clear-auth-tables.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
