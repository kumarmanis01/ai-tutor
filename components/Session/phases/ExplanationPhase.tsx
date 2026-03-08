'use client';
/**
 * FILE OBJECTIVE:
 * - Phase 2: EXPLANATION — Renders the full topic note in a readable format.
 * - Handles multiple contentJson schemas (custom sections/concepts, ProseMirror doc).
 * - Implements spec: "short paragraphs, highlighted key ideas, diagrams placeholder."
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Session Container Architecture
 */

import React from 'react';
import type { ExplanationContent } from '@/lib/session/getPhaseContent';

// ─── Content JSON normalisation ──────────────────────────────────────────────
// Topic notes can be stored in several JSON shapes. These helpers extract
// readable sections from the most common formats without crashing on unknown ones.

interface NormalisedSection {
  title?: string;
  body: string;
}

function extractSections(contentJson: unknown): NormalisedSection[] {
  if (!contentJson || typeof contentJson !== 'object') return [];

  const json = contentJson as Record<string, unknown>;

  // Unwrap nested { content: { ... } } envelope
  const root: Record<string, unknown> =
    json.content && typeof json.content === 'object'
      ? (json.content as Record<string, unknown>)
      : json;

  const sections: NormalisedSection[] = [];

  // Shape A: { summary/introduction, sections[], concepts[] }
  const intro =
    typeof root.introduction === 'string'
      ? root.introduction
      : typeof root.summary === 'string'
        ? root.summary
        : null;

  if (intro) sections.push({ body: intro });

  if (Array.isArray(root.sections)) {
    for (const s of root.sections) {
      if (typeof s === 'object' && s !== null) {
        const sec = s as Record<string, unknown>;
        const title = typeof sec.title === 'string' ? sec.title : undefined;
        const body =
          typeof sec.body === 'string'
            ? sec.body
            : typeof sec.content === 'string'
              ? sec.content
              : '';
        if (body) sections.push({ title, body });
      }
    }
  }

  if (Array.isArray(root.concepts)) {
    for (const c of root.concepts) {
      if (typeof c === 'object' && c !== null) {
        const concept = c as Record<string, unknown>;
        const title = typeof concept.title === 'string' ? concept.title : undefined;
        const body =
          typeof concept.explanation === 'string'
            ? concept.explanation
            : typeof concept.body === 'string'
              ? concept.body
              : '';
        if (body) sections.push({ title, body });
      }
    }
  }

  // Shape B: ProseMirror doc { type: 'doc', content: [...nodes] }
  if (root.type === 'doc' && Array.isArray(root.content)) {
    for (const node of root.content as Record<string, unknown>[]) {
      sections.push(...extractProseMirrorNode(node));
    }
  }

  // Fallback: just try to find any string values
  if (sections.length === 0) {
    const text = Object.values(root)
      .filter((v) => typeof v === 'string' && (v as string).length > 20)
      .join('\n\n');
    if (text) sections.push({ body: text });
  }

  return sections;
}

function extractProseMirrorNode(node: Record<string, unknown>): NormalisedSection[] {
  if (!node || typeof node !== 'object') return [];

  const type = node.type as string;
  const content = Array.isArray(node.content) ? node.content as Record<string, unknown>[] : [];

  const textFromInline = (nodes: Record<string, unknown>[]): string =>
    nodes
      .filter((n) => n.type === 'text')
      .map((n) => String(n.text ?? ''))
      .join('');

  if (type === 'heading') {
    return []; // headings handled as titles in the next paragraph
  }

  if (type === 'paragraph') {
    const body = textFromInline(content);
    return body ? [{ body }] : [];
  }

  if (type === 'bulletList' || type === 'orderedList') {
    const items = content
      .flatMap((li) =>
        Array.isArray(li.content)
          ? (li.content as Record<string, unknown>[]).flatMap(extractProseMirrorNode)
          : [],
      )
      .map((s) => `• ${s.body}`)
      .join('\n');
    return items ? [{ body: items }] : [];
  }

  // Recurse for blockquote, etc.
  if (content.length > 0) {
    return content.flatMap(extractProseMirrorNode);
  }

  return [];
}

// ─── Component ───────────────────────────────────────────────────────────────

interface ExplanationPhaseProps {
  content: ExplanationContent;
  onNext: () => void;
  loading?: boolean;
}

export function ExplanationPhase({ content, onNext, loading }: ExplanationPhaseProps) {
  const sections = extractSections(content.contentJson);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-foreground mb-6">{content.title}</h1>

      {sections.length === 0 ? (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-700 dark:text-amber-400">
          Content is loading. Please come back shortly.
        </div>
      ) : (
        <div className="space-y-5">
          {sections.map((section, i) => (
            <div
              key={i}
              className={
                section.title
                  ? 'bg-card rounded-xl border p-4'
                  : ''
              }
            >
              {section.title && (
                <h2 className="font-semibold text-foreground mb-2">{section.title}</h2>
              )}
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                {section.body}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Tutor tip placeholder — future: inject from content metadata */}
      <div className="mt-6 bg-blue-500/5 border border-blue-500/15 rounded-xl p-4 flex items-start gap-3">
        <span className="text-lg flex-shrink-0">💡</span>
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Tutor tip: </span>
          Read through each concept carefully. If something is unclear, come back after practice.
        </p>
      </div>

      {/* Micro-progress confirmation */}
      <div className="mt-6 pt-4 border-t border-border/50">
        <p className="text-xs text-muted-foreground mb-3">
          ✓ Explanation complete — next: Practice questions
        </p>
        <button
          onClick={onNext}
          disabled={loading}
          className="w-full py-4 px-6 bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
        >
          {loading ? (
            <span className="animate-spin">⏳</span>
          ) : (
            <>
              <span>Continue to Practice</span>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default ExplanationPhase;
