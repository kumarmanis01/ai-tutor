import fs from 'fs';
import path from 'path';

test('file exists: components/AdminAnalytics/sparklinePath.ts', () => {
  const p = path.join(process.cwd(), 'components/AdminAnalytics/sparklinePath.ts');
  expect(fs.existsSync(p)).toBe(true);
});
