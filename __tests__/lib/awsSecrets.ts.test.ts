import fs from 'fs';
import path from 'path';

test('file exists: lib/awsSecrets.ts', () => {
  const p = path.join(process.cwd(), 'lib/awsSecrets.ts');
  expect(fs.existsSync(p)).toBe(true);
});
