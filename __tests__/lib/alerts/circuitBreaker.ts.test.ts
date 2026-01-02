import fs from 'fs';
import path from 'path';

test('file exists: lib/alerts/circuitBreaker.ts', () => {
  const p = path.join(process.cwd(), 'lib/alerts/circuitBreaker.ts');
  expect(fs.existsSync(p)).toBe(true);
});
