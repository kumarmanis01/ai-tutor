import fs from 'fs';
import path from 'path';

describe('exists lib/execution-pipeline/submitJob.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/execution-pipeline/submitJob.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
