"use client";

/**
 * FILE OBJECTIVE:
 * - Render a minimal SVG diagram from a structured `visualHint` brief.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/session/visualHintRenderer.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-13T00:00:00Z | copilot | created minimal visual hint renderer
 */

import React from 'react';

type VisualHintRendererProps = {
  hint: string;
  width?: number;
  height?: number;
  className?: string;
};

type Shape =
  | { type: 'circle'; cx: number; cy: number; r: number; label?: string }
  | { type: 'rect'; x: number; y: number; w: number; h: number; label?: string }
  | { type: 'line'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'text'; x: number; y: number; text: string };

function tryParseShapes(hint: string): Shape[] | null {
  // Prefer JSON with a `shapes` array
  try {
    const j = JSON.parse(hint);
    if (j && Array.isArray(j.shapes)) return j.shapes as Shape[];
  } catch {
    // not JSON
  }

  // Fallback: simple line-based DSL (circle/rect/line/text)
  const lines = hint
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const shapes: Shape[] = [];
  for (const line of lines) {
    const parts = line.split(/\s+/);
    const cmd = parts[0]?.toLowerCase();
    if (cmd === 'circle' && parts.length >= 4) {
      const cx = Number(parts[1]) || 50;
      const cy = Number(parts[2]) || 30;
      const r = Number(parts[3]) || 6;
      const label = parts.slice(4).join(' ') || undefined;
      shapes.push({ type: 'circle', cx, cy, r, label });
    } else if (cmd === 'rect' && parts.length >= 5) {
      const x = Number(parts[1]) || 10;
      const y = Number(parts[2]) || 10;
      const w = Number(parts[3]) || 30;
      const h = Number(parts[4]) || 15;
      const label = parts.slice(5).join(' ') || undefined;
      shapes.push({ type: 'rect', x, y, w, h, label });
    } else if (cmd === 'line' && parts.length >= 5) {
      const x1 = Number(parts[1]) || 10;
      const y1 = Number(parts[2]) || 10;
      const x2 = Number(parts[3]) || 90;
      const y2 = Number(parts[4]) || 50;
      shapes.push({ type: 'line', x1, y1, x2, y2 });
    } else if (cmd === 'text' && parts.length >= 4) {
      const x = Number(parts[1]) || 10;
      const y = Number(parts[2]) || 10;
      const text = parts.slice(3).join(' ');
      shapes.push({ type: 'text', x, y, text });
    }
  }
  return shapes.length ? shapes : null;
}

export default function VisualHintRenderer({ hint, width: _width = 320, height = 160, className = '' }: VisualHintRendererProps) {
  const shapes = tryParseShapes(hint);
  if (!shapes) {
    return (
      <div className={`rounded-sm border border-gray-200 dark:border-slate-700 p-2 text-xs text-gray-700 dark:text-gray-100 ${className}`}>
        <div className="mb-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">Visual hint</div>
        <pre className="whitespace-pre-wrap break-words">{hint}</pre>
      </div>
    );
  }

  // Render into an SVG with a 100x60 viewBox; shapes may use those coords.
  return (
    <svg
      className={className}
      viewBox="0 0 100 60"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Visual hint diagram"
      width="100%"
      height={height}
    >
      <rect x={0} y={0} width={100} height={60} fill="none" />
      {shapes.map((s, i) => {
        if (s.type === 'circle') {
          const { cx, cy, r, label } = s;
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r={r} fill="#EEEDFE" stroke="#534AB7" />
              {label && (
                <text x={cx} y={cy + r + 3} fontSize={3.5} textAnchor="middle" fill="#3C3489">
                  {label}
                </text>
              )}
            </g>
          );
        }
        if (s.type === 'rect') {
          const { x, y, w, h, label } = s;
          return (
            <g key={i}>
              <rect x={x} y={y} width={w} height={h} fill="#EAF3DE" stroke="#1D9E75" />
              {label && (
                <text x={x + w / 2} y={y + h / 2 + 2} fontSize={3.5} textAnchor="middle" fill="#1D9E75">
                  {label}
                </text>
              )}
            </g>
          );
        }
        if (s.type === 'line') {
          const { x1, y1, x2, y2 } = s;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#BA7517" strokeWidth={1.2} />;
        }
        if (s.type === 'text') {
          return (
            <text key={i} x={s.x} y={s.y} fontSize={3.5} fill="#3C3489">
              {s.text}
            </text>
          );
        }
        return null;
      })}
    </svg>
  );
}
