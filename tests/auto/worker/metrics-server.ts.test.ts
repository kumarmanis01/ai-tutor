import fs from 'fs';
import path from 'path';

describe('exists worker/metrics-server.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'worker', 'metrics-server.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
