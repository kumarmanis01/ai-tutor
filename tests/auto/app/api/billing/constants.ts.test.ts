describe('import app/api/billing/constants.ts', () => {
  it('imports without throwing', async () => {
    await expect(async () => {
      await import('../../../../app/api/billing/constants.ts');
    }).not.toThrow();
  });
});
