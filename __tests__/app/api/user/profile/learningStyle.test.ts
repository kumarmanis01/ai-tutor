import fs from 'fs';
import path from 'path';

test('profile route exports VALID_LEARNING_STYLES with expected values', () => {
  const p = path.join(process.cwd(), 'app/api/user/profile/route.ts');
  const src = fs.readFileSync(p, 'utf8');
  expect(src).toMatch(/export const VALID_LEARNING_STYLES/);
  expect(src).toMatch(/'visual'/);
  expect(src).toMatch(/'verbal'/);
  expect(src).toMatch(/'practice'/);
  expect(src).toMatch(/'mixed'/);
});
