import fs from 'fs';

describe('exists lib/alerts/sinks/webhook.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\alerts\\sinks\\webhook.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
