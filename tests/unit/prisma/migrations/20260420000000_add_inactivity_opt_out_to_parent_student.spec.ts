import fs from 'fs';
import path from 'path';

describe('Migration 20260420000000', () => {
  it('contains ALTER TABLE for ParentStudent inactivityOptOut', () => {
    const file = path.join(__dirname, '..', '..', '..', 'prisma', 'migrations', '20260420000000_add_inactivity_opt_out_to_parent_student', 'migration.sql');
    const content = fs.readFileSync(file, 'utf8');
    expect(content).toMatch(/ALTER TABLE \"ParentStudent\"/);
    expect(content).toMatch(/inactivityOptOut/);
  });
});
