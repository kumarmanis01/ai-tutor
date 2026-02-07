import fs from 'fs';
import path from 'path';

describe('exists src/jobs/analyticsJobs.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'src/jobs/analyticsJobs.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
