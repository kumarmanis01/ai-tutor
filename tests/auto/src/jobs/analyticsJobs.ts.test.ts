import fs from 'fs';

describe('exists src/jobs/analyticsJobs.ts', () => {
  it('source file exists on disk', () => {
    const p = "C:\\Users\\Spinzy Diagnostics\\Desktop\\ai-tutor\\src\\jobs\\analyticsJobs.ts";
    expect(fs.existsSync(p)).toBe(true);
  });
});
