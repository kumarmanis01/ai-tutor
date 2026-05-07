'use client';
/**
 * FILE OBJECTIVE:
 * - Phase 2: EXPLANATION -- Renders topic note content with TutorTipPanel.
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

interface ExplanationPhaseProps {
  content: ExplanationContent;
  topicName?: string;
  onReadyToProceed?: (ready: boolean) => void;
  loading?: boolean;
}

export function ExplanationPhase({
  content,
  topicName: _topicName,
  onReadyToProceed,
  loading: _loading,
}: ExplanationPhaseProps) {
  const sections = extractSections(content.contentJson);
  React.useEffect(() => {
    onReadyToProceed?.(true);
  }, [onReadyToProceed]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr,minmax(240px,280px)] gap-6 lg:gap-8 max-w-5xl mx-auto px-4 py-6">
      <main className="min-w-0">
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

        {/* Primary CTA is in SessionFooter */}
      </main>
      <aside className="order-first md:order-none md:sticky md:top-24 self-start">
        <TutorTipPanel tipText="Focus on the example carefully." />
      </aside>
    </div>
  );
}

export default ExplanationPhase;