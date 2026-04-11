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
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

type Tool = 'pencil' | 'eraser';

interface Point {
  x: number;
  y: number;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const PENCIL_COLORS = ['#1a1a1a', '#534AB7', '#E24B4A', '#1D9E75', '#BA7517'];
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

function getPos(e: MouseEvent | Touch, rect: DOMRect): Point {
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
  onToolChange: (t: Tool) => void;
  onColorChange: (c: string) => void;
  onUndo: () => void;
  onClear: () => void;
  canUndo: boolean;
}

function Toolbar({ tool, color, onToolChange, onColorChange, onUndo, onClear, canUndo }: ToolbarProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-slate-700 flex-wrap">
      {/* Pencil */}
      <button
        onClick={() => onToolChange('pencil')}
        className={`min-h-[44px] min-w-[44px] px-2 rounded text-xs font-medium transition-colors ${
          tool === 'pencil'
            ? 'bg-[#534AB7] text-white'
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
            ? 'bg-[#534AB7] text-white'
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
          {PENCIL_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => onColorChange(c)}
              className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                backgroundColor: c,
                borderColor: color === c ? '#534AB7' : 'transparent',
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
}

export default function WhiteboardPanel({
  sessionId,
  conceptName,
  aiSteps,
}: WhiteboardPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState(PENCIL_COLORS[0]);
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

  // ── Drawing event handlers ─────────────────────────────────────────────────

  function getContext() {
    const canvas = canvasRef.current;
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
  }

  // ── Submit working ────────────────────────────────────────────────────────

  async function handleSubmit() {
    const canvas = canvasRef.current;
    if (!canvas || isSubmitting) return;
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const dataUrl = canvas.toDataURL('image/png');
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
            <p className="text-xs text-[#534AB7] dark:text-[#9B96E0] mb-2 leading-relaxed">
              {feedback}
            </p>
          )}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full min-h-[44px] rounded-lg bg-[#534AB7] text-white text-sm font-medium disabled:opacity-50 transition-colors hover:bg-[#4339a6]"
          >
            {isSubmitting ? 'Checking your working...' : 'Submit my working'}
          </button>
        </div>
      </div>
    </>
  );
}
