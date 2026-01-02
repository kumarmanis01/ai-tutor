describe('import app/api/billing/utility.ts', () => {
  it('imports without throwing', async () => {
    await expect(async () => {
      await import('../../../../app/api/billing/utility.ts');
    }).not.toThrow();
  });
});
