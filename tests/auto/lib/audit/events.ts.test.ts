import fs from 'fs';

describe('exists lib/audit/events.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\audit\\events.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
