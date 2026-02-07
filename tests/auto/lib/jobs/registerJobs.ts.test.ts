import fs from 'fs';
import path from 'path';

describe('exists lib/jobs/registerJobs.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/jobs/registerJobs.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
