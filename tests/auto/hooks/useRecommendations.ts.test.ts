describe('import hooks/useRecommendations.ts', () => {
  it('imports without throwing', async () => {
    await expect(async () => {
      await import('../../hooks/useRecommendations.ts');
    }).not.toThrow();
  });
});
