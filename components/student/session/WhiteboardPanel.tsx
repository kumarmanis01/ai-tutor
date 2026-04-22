"use client";

/**
 * WhiteboardPanel -- F-STU-014
 *
 * A two-layer interactive whiteboard for the AI tutor session.
 *
 * Layer stack (bottom to top):
 *   ① AI steps layer  -- text lines that reveal one by one (requestAnimationFrame)
 *   ② Student canvas  -- freehand drawing with pencil / eraser tools
 *   ③ Toolbar         -- pencil size, eraser, undo, clear
 *   ④ Submit bar      -- "Submit my working" → LLM evaluates, shows Vidya feedback
 *
 * AC-01: Auto-activated for geometry / algebra / chemistry / physics subjects.
 * AC-02: AI steps reveal line by line via CSS keyframe animation.
 * AC-03: Student canvas layer above the AI layer; supports mouse + touch.
 * AC-04: Submit merges both layers to PNG data URL → POST /api/student/whiteboard/evaluate.
 * AC-05: Undo (per-stroke ImageData snapshots) + Clear button.
 *
 * EDIT LOG:
 * - 2026-04-07 | claude | created for F-STU-014
 * - 2026-04-22T12:53:00Z | copilot | chore(theme): resolve token-backed primary/success/error colors at runtime for canvas + swatches
 * - 2026-04-22T14:10:00Z | copilot | feat(theme): use CSS token for Submit button and ensure swatches read runtime tokens; add unit-test coverage
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

type Tool = 'pencil' | 'eraser';

interface Point {
  x: number;
  y: number;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_PENCIL_COLORS = ['#1a1a1a', '#534AB7', '#E24B4A', '#1D9E75', '#BA7517'];
const STEP_REVEAL_MS = 600; // delay between each AI step appearing
const EVAL_TIMEOUT_MS = 10_000;

// CSS injected once for AI step animation (no animation library)
const WB_STYLE = `
@keyframes wb-step-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.wb-step { animation: wb-step-in 0.3s ease-out forwards; }
`;

// ── Helpers ────────────────────────────────────────────────────────────────────

function _getPos(e: MouseEvent | Touch, rect: DOMRect): Point {
  return {
    x: (e.clientX - rect.left) * (rect.width === 0 ? 1 : 1),
    y: (e.clientY - rect.top) * (rect.height === 0 ? 1 : 1),
  };
}

// ── Sub-component: AI steps layer ─────────────────────────────────────────────

function AiStepsList({ steps, visible }: { steps: string[]; visible: number }) {
  return (
    <div className="absolute inset-0 overflow-y-auto p-3 pointer-events-none select-none">
      {steps.slice(0, visible).map((step, i) => (
        <p
          key={i}
          className="wb-step text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-2"
        >
          {step}
        </p>
      ))}
    </div>
  );
}

// ── Sub-component: Toolbar ─────────────────────────────────────────────────────

interface ToolbarProps {
  tool: Tool;
  color: string;
  colors: string[];
  onToolChange: (t: Tool) => void;
  onColorChange: (c: string) => void;
  onUndo: () => void;
  onClear: () => void;
  canUndo: boolean;
}

function Toolbar({ tool, color, colors, onToolChange, onColorChange, onUndo, onClear, canUndo }: ToolbarProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-slate-700 flex-wrap">
      {/* Pencil */}
      <button
        onClick={() => onToolChange('pencil')}
        className={`min-h-[44px] min-w-[44px] px-2 rounded text-xs font-medium transition-colors ${
          tool === 'pencil'
            ? 'bg-[var(--color-primary)] text-white'
            : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'
        }`}
        aria-pressed={tool === 'pencil'}
        title="Pencil"
      >
        ✏
      </button>

      {/* Eraser */}
      <button
        onClick={() => onToolChange('eraser')}
        className={`min-h-[44px] min-w-[44px] px-2 rounded text-xs font-medium transition-colors ${
          tool === 'eraser'
            ? 'bg-[var(--color-primary)] text-white'
            : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'
        }`}
        aria-pressed={tool === 'eraser'}
        title="Eraser"
      >
        ⬜
      </button>

      {/* Color swatches -- only for pencil */}
      {tool === 'pencil' && (
        <div className="flex gap-1.5">
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => onColorChange(c)}
              className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                backgroundColor: c,
                borderColor: color === c ? 'var(--color-primary)' : 'transparent',
              }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
      )}

      <div className="ml-auto flex gap-2">
        {/* Undo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="min-h-[44px] min-w-[44px] px-2 rounded text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 disabled:opacity-40 transition-colors hover:bg-gray-200 dark:hover:bg-slate-600"
          title="Undo"
        >
          ↩
        </button>

        {/* Clear */}
        <button
          onClick={onClear}
          className="min-h-[44px] px-3 rounded text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 transition-colors hover:bg-gray-200 dark:hover:bg-slate-600"
          title="Clear canvas"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface WhiteboardPanelProps {
  sessionId: string;
  conceptName: string;
  /** Lines from AI messages, revealed one by one. */
  aiSteps: string[];
  /** Optional structured visual hint (diagram) from the LLM. */
  visualHint?: string | null;
}

export default function WhiteboardPanel({
  sessionId,
  conceptName,
  aiSteps,
  visualHint,
}: WhiteboardPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const aiCanvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('pencil');
  const [pencilColors, setPencilColors] = useState<string[]>(DEFAULT_PENCIL_COLORS);
  const [color, setColor] = useState<string>(DEFAULT_PENCIL_COLORS[0]);
  const [snapshots, setSnapshots] = useState<ImageData[]>([]); // for undo
  const [isDrawing, setIsDrawing] = useState(false);
  const [visibleSteps, setVisibleSteps] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Reveal AI steps one by one with a timer.
  useEffect(() => {
    if (visibleSteps >= aiSteps.length) return;
    const id = setTimeout(() => setVisibleSteps((n) => n + 1), STEP_REVEAL_MS);
    return () => clearTimeout(id);
  }, [visibleSteps, aiSteps.length]);

  // When new AI steps arrive (aiSteps array grows), reset visible count.
  const prevStepCount = useRef(aiSteps.length);
  useEffect(() => {
    if (aiSteps.length > prevStepCount.current) {
      prevStepCount.current = aiSteps.length;
      setVisibleSteps(0); // re-animate from the start for the latest message
    }
  }, [aiSteps.length]);

  // Resolve runtime token-backed colors (CSS variables) for use in canvas and swatches.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const s = getComputedStyle(document.documentElement);
    const primary = s.getPropertyValue('--color-primary').trim() || DEFAULT_PENCIL_COLORS[1];
    const success = s.getPropertyValue('--color-success').trim() || DEFAULT_PENCIL_COLORS[3];
    const warning = s.getPropertyValue('--color-warning').trim() || DEFAULT_PENCIL_COLORS[4];
    const error = s.getPropertyValue('--color-error').trim() || DEFAULT_PENCIL_COLORS[2];
    const resolved = ['#1a1a1a', primary, error, success, warning];
    setPencilColors(resolved);
    setColor((c) => (c === DEFAULT_PENCIL_COLORS[1] ? primary : c));
  }, []);

  // ── Drawing event handlers ─────────────────────────────────────────────────

  function getContext() {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    return { canvas, ctx };
  }

  function getAiContext() {
    const canvas = aiCanvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    return { canvas, ctx };
  }

  const startDraw = useCallback(
    (x: number, y: number) => {
      const r = getContext();
      if (!r) return;
      const { canvas, ctx } = r;
      // Snapshot before stroke for undo
      setSnapshots((prev) => [
        ...prev.slice(-19), // keep last 20 snapshots
        ctx.getImageData(0, 0, canvas.width, canvas.height),
      ]);
      ctx.beginPath();
      ctx.moveTo(x, y);
      if (tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = 24;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      setIsDrawing(true);
    },
    [tool, color],
  );

  const continueDraw = useCallback(
    (x: number, y: number) => {
      if (!isDrawing) return;
      const r = getContext();
      if (!r) return;
      r.ctx.lineTo(x, y);
      r.ctx.stroke();
    },
    [isDrawing],
  );

  const endDraw = useCallback(() => {
    setIsDrawing(false);
    const r = getContext();
    if (r) {
      r.ctx.globalCompositeOperation = 'source-over';
    }
  }, []);

  // Mouse events
  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    startDraw(e.clientX - rect.left, e.clientY - rect.top);
  }
  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    continueDraw(e.clientX - rect.left, e.clientY - rect.top);
  }

  // Touch events (mobile)
  function onTouchStart(e: React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const t = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    startDraw(t.clientX - rect.left, t.clientY - rect.top);
  }
  function onTouchMove(e: React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (!isDrawing) return;
    const t = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    continueDraw(t.clientX - rect.left, t.clientY - rect.top);
  }

  // ── Undo / Clear ──────────────────────────────────────────────────────────

  function handleUndo() {
    const r = getContext();
    if (!r || snapshots.length === 0) return;
    const prev = snapshots[snapshots.length - 1];
    r.ctx.putImageData(prev, 0, 0);
    setSnapshots((s) => s.slice(0, -1));
  }

  function handleClear() {
    const r = getContext();
    if (!r) return;
    r.ctx.clearRect(0, 0, r.canvas.width, r.canvas.height);
    setSnapshots([]);
    setFeedback(null);
    // Also clear AI-rendered diagram layer
    clearAiCanvas();
  }

  // ── Submit working ────────────────────────────────────────────────────────

  async function handleSubmit() {
    const canvas = canvasRef.current;
    if (!canvas || isSubmitting) return;
    setIsSubmitting(true);
    setFeedback(null);
    try {
      // Merge AI layer (aiCanvas) and student canvas into a single image for evaluation.
      const student = canvasRef.current!;
      const ai = aiCanvasRef.current;
      const w = student.width;
      const h = student.height;
      const off = document.createElement('canvas');
      off.width = w;
      off.height = h;
      const offCtx = off.getContext('2d')!;
      // Draw AI diagram first (if present)
      if (ai) offCtx.drawImage(ai, 0, 0, w, h);
      // Draw student layer on top
      offCtx.drawImage(student, 0, 0, w, h);
      const dataUrl = off.toDataURL('image/png');

      // AC-06: Persist whiteboard state as a SessionArtifact for session replay (fire-and-forget).
      void fetch('/api/student/session-artifact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, type: 'whiteboard', dataUrl }),
      }).catch(() => {
        // Non-critical: artifact save failure does not block evaluation
      });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), EVAL_TIMEOUT_MS);
      const res = await fetch('/api/student/whiteboard/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, conceptName, canvasDataUrl: dataUrl }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const json = await res.json();
      setFeedback(json.feedback ?? "Keep going -- your working looks like a great start!");
    } catch {
      setFeedback("Keep working through it -- you're on the right track!");
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Visual hint parsing & replay ─────────────────────────────────────────

  type DPoint = { x: number; y: number };
  type StrokeCommand = { type: 'stroke'; color?: string; width?: number; points: DPoint[] };
  type LineCommand = { type: 'line'; from: DPoint; to: DPoint; color?: string; width?: number };
  type CircleCommand = { type: 'circle'; center: DPoint; r: number; color?: string; width?: number };
  type TextCommand = { type: 'text'; x: number; y: number; text: string; color?: string; size?: number };
  type DrawingCommand = StrokeCommand | LineCommand | CircleCommand | TextCommand;

  const replayTimers = useRef<number[]>([]);

  function clearReplayTimers() {
    for (const t of replayTimers.current) window.clearTimeout(t);
    replayTimers.current = [];
  }

  function normalizePoint(p: any, w: number, h: number): DPoint {
    if (typeof p !== 'object' || p === null) return { x: 0, y: 0 };
    const x = Number(p.x ?? p[0] ?? 0);
    const y = Number(p.y ?? p[1] ?? 0);
    // If values look like 0..1 assume normalized, if 0..100 treat as percent, else pixels
    const nx = x <= 1 ? x * w : x <= 100 ? (x / 100) * w : x;
    const ny = y <= 1 ? y * h : y <= 100 ? (y / 100) * h : y;
    return { x: nx, y: ny };
  }

  function parseVisualCommands(viz: string | null): DrawingCommand[] | null {
    if (!viz) return null;
    const trimmed = String(viz).trim();
    // If looks like JSON, attempt parse
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        const arr = Array.isArray(parsed) ? parsed : parsed.commands ?? parsed.strokes ?? null;
        if (!Array.isArray(arr)) return null;
        // Map into normalized shape (points left as-is; normalization applied during drawing)
        return arr as DrawingCommand[];
      } catch {
        return null;
      }
    }
    return null;
  }

  function clearAiCanvas() {
    const r = getAiContext();
    if (!r) return;
    r.ctx.clearRect(0, 0, r.canvas.width, r.canvas.height);
  }

  function playCommands(commands: DrawingCommand[] | null) {
    clearReplayTimers();
    clearAiCanvas();
    if (!commands || commands.length === 0) return;
    const aiCtxWrap = getAiContext();
    if (!aiCtxWrap) return;
    const { canvas: aiCanvas, ctx: aiCtx } = aiCtxWrap;
    const w = aiCanvas.width;
    const h = aiCanvas.height;

    let delay = 0;
    for (const cmd of commands) {
      if (cmd.type === 'stroke') {
        const stroke = cmd as StrokeCommand;
        const pts = (stroke.points || []).map((p) => normalizePoint(p, w, h));
        // Schedule incremental drawing of this stroke
        const interval = 20; // ms per point
        for (let i = 0; i < pts.length; i++) {
          const pt = pts[i];
          const t = window.setTimeout(() => {
            if (i === 0) {
              aiCtx.beginPath();
              aiCtx.moveTo(pt.x, pt.y);
              aiCtx.globalCompositeOperation = 'source-over';
              aiCtx.strokeStyle = stroke.color ?? '#1a1a1a';
              aiCtx.lineWidth = stroke.width ?? 2.5;
              aiCtx.lineCap = 'round';
              aiCtx.lineJoin = 'round';
            } else {
              aiCtx.lineTo(pt.x, pt.y);
              aiCtx.stroke();
            }
          }, delay + i * interval);
          replayTimers.current.push(t);
        }
        delay += Math.max(pts.length * 20, 120);
      } else if (cmd.type === 'line') {
        const c = cmd as LineCommand;
        const from = normalizePoint((c as any).from, w, h);
        const to = normalizePoint((c as any).to, w, h);
        const t = window.setTimeout(() => {
          aiCtx.beginPath();
          aiCtx.moveTo(from.x, from.y);
          aiCtx.lineTo(to.x, to.y);
          aiCtx.strokeStyle = c.color ?? '#1a1a1a';
          aiCtx.lineWidth = c.width ?? 2.5;
          aiCtx.lineCap = 'round';
          aiCtx.stroke();
        }, delay);
        replayTimers.current.push(t);
        delay += 120;
      } else if (cmd.type === 'circle') {
        const c = cmd as CircleCommand;
        const center = normalizePoint((c as any).center, w, h);
        const t = window.setTimeout(() => {
          aiCtx.beginPath();
          aiCtx.arc(center.x, center.y, (c as any).r ?? 20, 0, Math.PI * 2);
          aiCtx.strokeStyle = c.color ?? '#1a1a1a';
          aiCtx.lineWidth = c.width ?? 2.5;
          aiCtx.stroke();
        }, delay);
        replayTimers.current.push(t);
        delay += 120;
      } else if (cmd.type === 'text') {
        const c = cmd as TextCommand;
        const pos = normalizePoint({ x: c.x, y: c.y }, w, h);
        const t = window.setTimeout(() => {
          aiCtx.fillStyle = c.color ?? '#1a1a1a';
          aiCtx.font = `${c.size ?? 14}px sans-serif`;
          aiCtx.fillText(c.text, pos.x, pos.y);
        }, delay);
        replayTimers.current.push(t);
        delay += 80;
      }
    }
  }

  // Auto-replay when visualHint prop changes
  useEffect(() => {
    if (!('visualHint' in ({} as any))) return; // type-narrow safety
    // If visualHint is null/empty, clear AI canvas
    if (!visualHint) {
      clearReplayTimers();
      clearAiCanvas();
      return;
    }
    const commands = parseVisualCommands(visualHint ?? null);
    if (commands) {
      // Ensure ai canvas matches student canvas sizing
      const st = canvasRef.current;
      const ai = aiCanvasRef.current;
      if (st && ai) {
        ai.width = st.width;
        ai.height = st.height;
      }
      playCommands(commands);
    } else {
      // Not structured JSON -- do nothing (visualHint may be natural-language guidance).
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visualHint]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{WB_STYLE}</style>
      <div className="flex flex-col h-full border border-gray-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-2.5 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
            Whiteboard
          </span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            Draw your working below
          </span>
        </div>

        <Toolbar
          tool={tool}
          color={color}
          colors={pencilColors}
          onToolChange={setTool}
          onColorChange={setColor}
          onUndo={handleUndo}
          onClear={handleClear}
          canUndo={snapshots.length > 0}
        />

        {/* Canvas area */}
        <div className="relative flex-1 bg-gray-50 dark:bg-slate-800 overflow-hidden min-h-0">
          {/* AC-02: AI steps layer */}
          <AiStepsList steps={aiSteps} visible={visibleSteps} />

          {/* AC-03: AI drawing layer (replayed from visualHint) */}
          <canvas
            ref={aiCanvasRef}
            width={600}
            height={400}
            className="absolute inset-0 w-full h-full touch-none pointer-events-none"
            aria-hidden
          />

          {/* AC-03: Student drawing layer */}
          <canvas
            ref={canvasRef}
            width={600}
            height={400}
            className="absolute inset-0 w-full h-full touch-none"
            style={{ cursor: tool === 'pencil' ? 'crosshair' : 'cell' }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={endDraw}
          />
        </div>

        {/* AC-04: Submit bar */}
        <div className="px-3 py-2 border-t border-gray-100 dark:border-slate-700">
          {feedback && (
            <p className="text-xs text-[var(--color-primary)] dark:text-[var(--color-primary-hover)] mb-2 leading-relaxed">
              {feedback}
            </p>
          )}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full min-h-[44px] rounded-lg text-white text-sm font-medium disabled:opacity-50 transition-colors bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]"
            style={{ backgroundColor: undefined }}
          >
            {isSubmitting ? 'Checking your working...' : 'Submit my working'}
          </button>
        </div>
      </div>
    </>
  );
}
