/*
 Integration test for AuditLog immutability.
 This test runs only when RUN_DB_INTEGRATION=1 is set in the environment.
 It requires the DB migrations to have been applied so the trigger exists.
*/
const runIntegration = process.env.RUN_DB_INTEGRATION === '1';

if (!runIntegration) {
  test.skip('DB integration tests disabled (set RUN_DB_INTEGRATION=1 to enable)', () => {});
} else {
  jest.setTimeout(30_000);
  const { prisma } = require('@/lib/prisma');

  test('attempts to UPDATE AuditLog should fail (immutable)', async () => {
    // Create a test audit log entry
    const created = await prisma.auditLog.create({
      data: { targetEntity: 'INTEGRATION_TEST', targetId: 't1' },
    });
    expect(created).toBeDefined();

    // Attempt to update a protected column (e.g., reason) — should error due to trigger
    let threw = false;
    try {
      await prisma.$executeRaw`UPDATE "AuditLog" SET "reason" = 'malicious' WHERE id = ${created.id}`;
    } catch (e) {
      threw = true;
    }

    expect(threw).toBe(true);
  });
}
