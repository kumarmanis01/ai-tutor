/**
 * ScoreTrendGraph -- SVG line chart showing score improvement over time.
 *
 * No external dependencies. Renders at full container width (responsive via viewBox).
 * Brand primary #534AB7 for the line and dots; neutral greys for grid/labels.
 *
 * Props:
 *   data       -- Array of { date: ISO string, score: 0-100 }, sorted oldest-first.
 *   className  -- Optional extra classes on the wrapping element.
 *
 * F-STU-020 AC-07.
 *
 * EDIT LOG:
 * - 2026-04-08 | claude | created for F-STU-020 AC-07
 */

export interface TrendPoint {
  date: string;   // ISO 8601
  score: number;  // 0-100
}

interface Props {
  data: TrendPoint[];
  className?: string;
}

// Canvas dimensions (viewBox units)
const W = 300;
const H = 130;
const PAD = { top: 20, right: 16, bottom: 30, left: 32 };
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;

const PRIMARY = '#534AB7';
const GRID = '#E5E7EB';
const LABEL = '#9CA3AF';
const GRID_SCORES = [0, 50, 100];

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function ScoreTrendGraph({ data, className = '' }: Props) {
  if (data.length === 0) {
    return (
      <p className={`text-sm text-gray-400 dark:text-gray-500 py-6 text-center ${className}`}>
        Complete a chapter practice test to track your score trend.
      </p>
    );
  }

  const n = data.length;

  function toX(i: number): number {
    return PAD.left + (n > 1 ? (i / (n - 1)) * INNER_W : INNER_W / 2);
  }

  function toY(score: number): number {
    const clamped = Math.min(100, Math.max(0, score));
    return PAD.top + INNER_H - (clamped / 100) * INNER_H;
  }

  const polylinePoints = data
    .map((d, i) => `${toX(i).toFixed(1)},${toY(d.score).toFixed(1)}`)
    .join(' ');

  // X-axis labels: first, middle, last -- avoids overlap on small screens.
  const xLabelIndices =
    n <= 2
      ? Array.from({ length: n }, (_, i) => i)
      : [0, Math.floor((n - 1) / 2), n - 1];

  // Score labels: only first and last dots to keep the chart uncluttered.
  const scoreLabelIndices = Array.from(new Set([0, n - 1]));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label="Score improvement trend chart"
      className={className}
    >
      {/* Y-axis grid lines + labels */}
      {GRID_SCORES.map((s) => {
        const y = toY(s);
        return (
          <g key={s}>
            <line
              x1={PAD.left}
              y1={y}
              x2={W - PAD.right}
              y2={y}
              stroke={GRID}
              strokeWidth={1}
            />
            <text
              x={PAD.left - 4}
              y={y + 3.5}
              textAnchor="end"
              fontSize={8}
              fill={LABEL}
            >
              {s}
            </text>
          </g>
        );
      })}

      {/* Line connecting all dots */}
      {n > 1 && (
        <polyline
          points={polylinePoints}
          fill="none"
          stroke={PRIMARY}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {/* Score labels on first and last data point */}
      {scoreLabelIndices.map((i) => {
        const y = toY(data[i].score);
        // Place label above the dot unless it would clip out of the top padding.
        const labelY = y > PAD.top + 12 ? y - 7 : y + 15;
        return (
          <text
            key={`sl-${i}`}
            x={toX(i)}
            y={labelY}
            textAnchor="middle"
            fontSize={9}
            fill={PRIMARY}
            fontWeight="600"
          >
            {data[i].score}%
          </text>
        );
      })}

      {/* Dots */}
      {data.map((d, i) => (
        <circle
          key={`dot-${i}`}
          cx={toX(i)}
          cy={toY(d.score)}
          r={3.5}
          fill={PRIMARY}
          stroke="white"
          strokeWidth={1.5}
        />
      ))}

      {/* X-axis date labels */}
      {xLabelIndices.map((i) => (
        <text
          key={`xl-${i}`}
          x={toX(i)}
          y={H - 7}
          textAnchor="middle"
          fontSize={8}
          fill={LABEL}
        >
          {shortDate(data[i].date)}
        </text>
      ))}
    </svg>
  );
}
