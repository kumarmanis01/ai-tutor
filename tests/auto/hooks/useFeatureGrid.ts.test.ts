describe('import hooks/useFeatureGrid.ts', () => {
  it('imports without throwing', async () => {
    await expect(async () => {
      await import('../../hooks/useFeatureGrid.ts');
    }).not.toThrow();
  });
});
