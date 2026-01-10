import fs from 'fs';
import path from 'path';

describe('exists src/jobs/regenerationJobRunner.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'src', 'jobs', 'regenerationJobRunner.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
