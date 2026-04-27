export function buildSparklinePath(points: number[], width = 300, height = 50) {
  if (!points || points.length === 0) return ''
  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = max - min || 1
  const stride = width / (points.length - 1 || 1)
  const path = points
    .map((p, i) => {
      const x = i * stride
      const y = height - ((p - min) / range) * height
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
  return path
}

export default buildSparklinePath
