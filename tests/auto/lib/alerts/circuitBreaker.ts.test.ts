import fs from 'fs';
import path from 'path';

describe('exists lib/alerts/circuitBreaker.ts', () => {
  it('source file exists on disk', () => {
    const p = path.join(process.cwd(), 'lib/alerts/circuitBreaker.ts');
    expect(fs.existsSync(p)).toBe(true);
  });
});
