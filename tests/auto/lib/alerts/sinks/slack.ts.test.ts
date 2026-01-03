import fs from 'fs';

describe('exists lib/alerts/sinks/slack.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\alerts\\sinks\\slack.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
