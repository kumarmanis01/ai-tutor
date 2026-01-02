describe('import hooks/useCurrentUser.ts', () => {
  it('imports without throwing', async () => {
    await expect(async () => {
      await import('../../hooks/useCurrentUser.ts');
    }).not.toThrow();
  });
});
