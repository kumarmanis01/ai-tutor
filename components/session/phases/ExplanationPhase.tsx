'use client';
/**
 * FILE OBJECTIVE:
 * - Phase 2: EXPLANATION — Renders topic note content with TutorTipPanel.
 * - Uses sessionUtils.extractSections() for content normalisation (not inline).
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | moved to components/session/phases/ + uses sessionUtils
 *                          + integrates TutorTipPanel (closes Gap #14)
 */

import React from 'react';
import type { ExplanationContent } from '@/lib/session/getPhaseContent';
import { extractSections } from '@/lib/session/sessionUtils';
import { TutorTipPanel } from '@/components/session/TutorTipPanel';
import { PHASE_UI_CONFIG } from '@/lib/session/phaseConfig';

interface ExplanationPhaseProps {
  content: ExplanationContent;
  topicName?: string;
  onNext: () => void;
  loading?: boolean;
}

export function ExplanationPhase({ content, topicName, onNext, loading }: ExplanationPhaseProps) {
  const sections = extractSections(content.contentJson);
  const config = PHASE_UI_CONFIG.EXPLANATION;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-foreground mb-6">{content.title}</h1>

      {sections.length === 0 ? (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-700 dark:text-amber-400">
          Content is being prepared. Please come back shortly.
        </div>
      ) : (
        <div className="space-y-5">
          {sections.map((section, i) => (
            <div key={i} className={section.title ? 'bg-card rounded-xl border p-4' : ''}>
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

      {/* Tutor Tip Panel — closes Gap #14 */}
      <TutorTipPanel phase="EXPLANATION" topicName={topicName} />

      <div className="mt-6 pt-4 border-t border-border/50">
        <p className="text-xs text-muted-foreground mb-3">{config.completionNote}</p>
        <button
          onClick={onNext}
          disabled={loading}
          className="w-full py-4 px-6 bg-primary hover:bg-primary/90 disabled:opacity-60 text-primary-foreground font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
        >
          {loading ? <span className="animate-spin">⏳</span> : (
            <>
              <span>{config.ctaLabel}</span>
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
