import fs from 'fs';

describe('exists worker/orchestrator.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\worker\\orchestrator.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
