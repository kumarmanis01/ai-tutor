// test-only: use sparkline helper directly
import { buildSparklinePath } from '../../components/AdminAnalytics/sparklinePath'

describe('Sparkline component', () => {
  it('renders path for numeric points', () => {
    const path = buildSparklinePath([1, 3, 2, 5], 200, 40)
    expect(path).toContain('M')
    expect(path).toContain('L')
  })

  it('shows No data for empty points', () => {
    const path = buildSparklinePath([], 200, 40)
    expect(path).toBe('')
  })
})
