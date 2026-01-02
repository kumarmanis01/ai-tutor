import fs from 'fs';

describe('exists lib/promotion/service.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\promotion\\service.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
