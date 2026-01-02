import fs from 'fs';

describe('exists workers/regenerationWorker.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\workers\\regenerationWorker.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
