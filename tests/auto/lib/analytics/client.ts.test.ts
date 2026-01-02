import fs from 'fs';

describe('exists lib/analytics/client.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\analytics\\client.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
