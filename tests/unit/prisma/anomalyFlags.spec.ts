import fs from 'fs';
import path from 'path';

test('prisma schema includes anomalyFlags in Message and AITutorTurnLog models', () => {
  const p = path.join(process.cwd(), 'prisma/schema.prisma');
  const s = fs.readFileSync(p, 'utf8');

  // Ensure Message model contains anomalyFlags Json?
  expect(s).toMatch(/model\s+Message[\s\S]*anomalyFlags\s+Json\?/);

  // Ensure AITutorTurnLog model contains anomalyFlags Json?
  expect(s).toMatch(/model\s+AITutorTurnLog[\s\S]*anomalyFlags\s+Json\?/);
});
