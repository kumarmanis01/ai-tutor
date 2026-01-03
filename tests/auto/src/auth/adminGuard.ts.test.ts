import fs from 'fs';

describe('exists src/auth/adminGuard.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\src\\auth\\adminGuard.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
