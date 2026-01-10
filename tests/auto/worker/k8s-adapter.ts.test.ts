import fs from 'fs';
import path from 'path';

describe('exists worker/k8s-adapter.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'worker', 'k8s-adapter.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
