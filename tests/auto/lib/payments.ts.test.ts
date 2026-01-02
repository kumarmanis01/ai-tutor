import fs from 'fs';

describe('exists lib/payments.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\payments.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
