describe('import hooks/useParentMode.ts', () => {
  it('imports without throwing', async () => {
    await expect(async () => {
      await import('../../hooks/useParentMode.ts');
    }).not.toThrow();
  });
});
