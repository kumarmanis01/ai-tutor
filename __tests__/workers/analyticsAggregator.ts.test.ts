import fs from 'fs';
import path from 'path';

test('file exists: workers/analyticsAggregator.ts', () => {
  const p = path.join(process.cwd(), 'workers/analyticsAggregator.ts');
  expect(fs.existsSync(p)).toBe(true);
});
