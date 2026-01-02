import fs from 'fs';
import path from 'path';

test('file exists: lib/alerts/sinks/slack.ts', () => {
  const p = path.join(process.cwd(), 'lib/alerts/sinks/slack.ts');
  expect(fs.existsSync(p)).toBe(true);
});
