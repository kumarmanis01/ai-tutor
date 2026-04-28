/**
 * FILE OBJECTIVE:
 * - Shared pure utility functions for session UI components.
 * - No React, no server-side imports -- safe everywhere.
 * - Centralises normalisation logic previously duplicated across phase components.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | extracted from PracticePhase, TestPhase, ExplanationPhase
 */

// ─── Choice / option normalisation ───────────────────────────────────────────

export interface Choice {
  key: string;
  label: string;
}

const CHOICE_KEYS = ['a', 'b', 'c', 'd'];

/**
 * Normalise MCQ choices/options (string[], object map) → { key, label }[].
 * Handles all formats returned by the session engine.
 */
export function normaliseChoices(raw: unknown): Choice[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return (raw as unknown[]).slice(0, 4).map((v, i) => ({
      key: CHOICE_KEYS[i],
      label: String(v),
    }));
  }
  if (typeof raw === 'object' && raw !== null) {
    return Object.entries(raw as Record<string, unknown>)
      .slice(0, 4)
      .map(([, v], i) => ({ key: CHOICE_KEYS[i], label: String(v) }));
  }
  return [];
}

// ─── Content JSON normalisation (for ExplanationPhase) ────────────────────────

export interface NormalisedSection {
  title?: string;
  body: string;
}

/**
 * Extract readable sections from a topic note's contentJson.
 * Handles three common schemas:
 *   1. Custom: { summary?, introduction?, sections[], concepts[] }
 *   2. Wrapped: { content: { ... } }
 *   3. ProseMirror: { type: 'doc', content: [...nodes] }
 */
export function extractSections(contentJson: unknown): NormalisedSection[] {
  if (!contentJson || typeof contentJson !== 'object') return [];

  const json = contentJson as Record<string, unknown>;
  const root: Record<string, unknown> =
    json.content && typeof json.content === 'object'
      ? (json.content as Record<string, unknown>)
      : json;

  const sections: NormalisedSection[] = [];

  // Intro / summary
  const intro =
    typeof root.introduction === 'string'
      ? root.introduction
      : typeof root.summary === 'string'
        ? root.summary
        : null;
  if (intro) sections.push({ body: intro });

  // sections[]
  if (Array.isArray(root.sections)) {
    for (const s of root.sections as Record<string, unknown>[]) {
      const title = typeof s.title === 'string' ? s.title : undefined;
      const body =
        typeof s.body === 'string' ? s.body : typeof s.content === 'string' ? s.content : '';
      if (body) sections.push({ title, body });
    }
  }

  // concepts[]
  if (Array.isArray(root.concepts)) {
    for (const c of root.concepts as Record<string, unknown>[]) {
      const title = typeof c.title === 'string' ? c.title : undefined;
      const body =
        typeof c.explanation === 'string'
          ? c.explanation
          : typeof c.body === 'string'
            ? c.body
            : '';
      if (body) sections.push({ title, body });
    }
  }

  // ProseMirror doc
  if (root.type === 'doc' && Array.isArray(root.content)) {
    sections.push(...extractProseMirrorNodes(root.content as Record<string, unknown>[]));
  }

  // Fallback: pick any string values longer than 20 chars
  if (sections.length === 0) {
    const text = Object.values(root)
      .filter((v): v is string => typeof v === 'string' && v.length > 20)
      .join('\n\n');
    if (text) sections.push({ body: text });
  }

  return sections;
}

function extractProseMirrorNodes(nodes: Record<string, unknown>[]): NormalisedSection[] {
  const sections: NormalisedSection[] = [];

  for (const node of nodes) {
    const type = String(node.type ?? '');
    const children = Array.isArray(node.content) ? (node.content as Record<string, unknown>[]) : [];

    if (type === 'paragraph') {
      const text = children
        .filter((n) => n.type === 'text')
        .map((n) => String(n.text ?? ''))
        .join('');
      if (text) sections.push({ body: text });
    } else if (type === 'bulletList' || type === 'orderedList') {
      const items = children
        .flatMap((li) =>
          Array.isArray(li.content)
            ? extractProseMirrorNodes(li.content as Record<string, unknown>[])
            : []
        )
        .map((s) => `• ${s.body}`)
        .join('\n');
      if (items) sections.push({ body: items });
    } else if (children.length > 0) {
      sections.push(...extractProseMirrorNodes(children));
    }
  }

  return sections;
}

// ─── Misc helpers ─────────────────────────────────────────────────────────────

/** Convert a 0-1 mastery score to a percentage label. */
export function masteryToPercent(mastery: number): number {
  return Math.round(Math.min(Math.max(mastery, 0), 1) * 100);
}

/** Get a colour class based on percentage score. */
export function scoreColour(pct: number): string {
  if (pct >= 80) return 'text-green-600';
  if (pct >= 60) return 'text-amber-600';
  return 'text-orange-600';
}

export function scoreBgColour(pct: number): string {
  if (pct >= 80) return 'bg-green-500';
  if (pct >= 60) return 'bg-amber-500';
  return 'bg-orange-500';
}
