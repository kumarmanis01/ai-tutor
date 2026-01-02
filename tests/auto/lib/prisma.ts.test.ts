import fs from 'fs';

describe('exists lib/prisma.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\prisma.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
