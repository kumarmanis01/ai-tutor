import fs from 'fs';
import path from 'path';

describe('Docker runbook', () => {
  it('contains Step 1 guidance', () => {
    const file = path.join(__dirname, '..', '..', 'docs', 'v2', 'docker_rules.md');
    const content = fs.readFileSync(file, 'utf8');
    expect(content).toMatch(/Step 1/);
  });
});
