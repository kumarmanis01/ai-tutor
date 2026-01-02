import fs from 'fs';

describe('exists lib/regeneration/retryService.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\regeneration\\retryService.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
