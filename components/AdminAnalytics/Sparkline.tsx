import React from 'react'
import { buildSparklinePath } from './sparklinePath'

export default function Sparkline({ points = [], width = 300, height = 50 }: { points?: number[]; width?: number; height?: number }) {
  if (!points || points.length === 0) {
    return React.createElement('svg', { width, height }, React.createElement('text', { x: 10, y: 20 }, 'No data'))
  }

  const path = buildSparklinePath(points, width, height)

  return React.createElement('svg', { width, height, viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: 'none' }, React.createElement('path', { d: path, fill: 'none', stroke: '#2563eb', strokeWidth: 2 }))
}
