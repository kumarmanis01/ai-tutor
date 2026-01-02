import fs from 'fs';

describe('exists lib/subscription.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\subscription.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
