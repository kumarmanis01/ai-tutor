import fs from 'fs';

describe('exists lib/content/approval/service.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\content\\approval\\service.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
