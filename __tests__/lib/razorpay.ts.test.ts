import fs from 'fs';
import path from 'path';

test('file exists: lib/razorpay.ts', () => {
  const p = path.join(process.cwd(), 'lib/razorpay.ts');
  expect(fs.existsSync(p)).toBe(true);
});
