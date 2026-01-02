describe('import hooks/useRecommendations.ts', () => {
  it('imports without throwing', () => {
    const path = require('path')
    const file = path.join(process.cwd(), 'hooks', 'useRecommendations.ts')
    expect(() => require(file)).not.toThrow()
  })
});
