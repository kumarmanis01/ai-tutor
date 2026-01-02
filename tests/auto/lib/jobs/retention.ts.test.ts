import fs from 'fs';

describe('exists lib/jobs/retention.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\jobs\\retention.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
