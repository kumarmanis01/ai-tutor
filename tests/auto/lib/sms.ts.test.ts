import fs from 'fs';

describe('exists lib/sms.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\sms.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
