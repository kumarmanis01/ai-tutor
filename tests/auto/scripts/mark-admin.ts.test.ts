import fs from 'fs';

describe('exists scripts/mark-admin.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\scripts\\mark-admin.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
