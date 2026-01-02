import fs from 'fs';

describe('exists lib/jobs/registerJobs.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\lib\\jobs\\registerJobs.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
