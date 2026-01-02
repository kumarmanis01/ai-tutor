describe('import hooks/useLearningSessionProgress.ts', () => {
  it('imports without throwing', async () => {
    await expect(async () => {
      await import('../../hooks/useLearningSessionProgress.ts');
    }).not.toThrow();
  });
});
