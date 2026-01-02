import fs from 'fs';

describe('exists lib/mailer.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\mailer.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
