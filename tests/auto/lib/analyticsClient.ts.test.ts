import fs from 'fs';

describe('exists lib/analyticsClient.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\analyticsClient.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
