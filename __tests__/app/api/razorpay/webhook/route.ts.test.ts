import fs from 'fs';
import path from 'path';

test('file exists: app/api/razorpay/webhook/route.ts', () => {
  const p = path.join(process.cwd(), 'app/api/razorpay/webhook/route.ts');
  expect(fs.existsSync(p)).toBe(true);
});
