import fs from 'fs';

describe('exists lib/safety/validatePackageSize.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\safety\\validatePackageSize.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
