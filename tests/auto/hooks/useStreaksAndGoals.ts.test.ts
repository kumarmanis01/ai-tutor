describe('import hooks/useStreaksAndGoals.ts', () => {
  it('imports without throwing', async () => {
    await expect(async () => {
      await import('../../hooks/useStreaksAndGoals.ts');
    }).not.toThrow();
  });
});
