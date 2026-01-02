import fs from 'fs';

describe('exists lib/alerts/sinks/dryRun.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\alerts\\sinks\\dryRun.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
