describe('import hooks/useLocalStorage.ts', () => {
  it('imports without throwing', async () => {
    await expect(async () => {
      await import('../../hooks/useLocalStorage.ts');
    }).not.toThrow();
  });
});
