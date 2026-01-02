import fs from 'fs';

describe('exists lib/i18n.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\i18n.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
