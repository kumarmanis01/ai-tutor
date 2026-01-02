import fs from 'fs';

describe('exists lib/guardrails.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\guardrails.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
