import fs from 'fs';

describe('exists workers/syllabusWorker.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\workers\\syllabusWorker.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
