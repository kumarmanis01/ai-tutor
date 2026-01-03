import fs from 'fs';

describe('exists lib/callLLM.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\callLLM.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
