import fs from 'fs';
import path from 'path';

describe('exists src/jobs/jobLock.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'src', 'jobs', 'jobLock.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
