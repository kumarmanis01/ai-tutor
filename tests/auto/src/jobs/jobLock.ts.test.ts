import fs from 'fs';

describe('exists src/jobs/jobLock.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\src\\jobs\\jobLock.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
