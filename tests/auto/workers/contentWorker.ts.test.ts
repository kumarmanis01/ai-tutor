import fs from 'fs';

describe('exists workers/contentWorker.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\workers\\contentWorker.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
