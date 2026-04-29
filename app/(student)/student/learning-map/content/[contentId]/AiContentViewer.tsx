'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';

interface AiContentViewerProps {
  contentId: string;
  topic: string;
  subject: string;
  grade: number;
  board: string;
  markdown: string;
}

type Stage = 'overview' | 'notes';

interface Section {
  heading: string;
  body: string;
}

function parseMarkdown(md: string): { intro: string; sections: Section[] } {
  const lines = md.split('\n');
  const sections: Section[] = [];
  let intro = '';
  let currentHeading = '';
  let currentBody: string[] = [];

  for (const line of lines) {
    const h2Match = /^##\s+(.+)/.exec(line);
    const h1Match = /^#\s+(.+)/.exec(line);
    if (h1Match && !intro) {
      // Skip the H1 title line -- we display topic from props
      continue;
    }
    if (h2Match) {
      if (currentHeading) {
        sections.push({ heading: currentHeading, body: currentBody.join('\n').trim() });
      } else if (currentBody.length > 0) {
        intro = currentBody.join('\n').trim();
      }
      currentHeading = h2Match[1].trim();
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }

  if (currentHeading) {
    sections.push({ heading: currentHeading, body: currentBody.join('\n').trim() });
  } else if (currentBody.length > 0 && !intro) {
    intro = currentBody.join('\n').trim();
  }

  return { intro, sections };
}

function renderInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-gray-100 dark:bg-slate-800 rounded px-1 text-sm font-mono">$1</code>');
}

function MarkdownBlock({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];

  function flushList() {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
          {listItems.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
          ))}
        </ul>
      );
      listItems = [];
    }
  }

  for (const line of lines) {
    const listMatch = /^[-*]\s+(.+)/.exec(line);
    const numberedMatch = /^\d+\.\s+(.+)/.exec(line);
    if (listMatch || numberedMatch) {
      listItems.push((listMatch ?? numberedMatch)![1]);
    } else {
      flushList();
      const trimmed = line.trim();
      if (trimmed) {
        elements.push(
          <p
            key={`p-${elements.length}`}
            className="mt-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300"
            dangerouslySetInnerHTML={{ __html: renderInline(trimmed) }}
          />
        );
      }
    }
  }
  flushList();

  return <>{elements}</>;
}

export default function AiContentViewer({
  topic,
  subject,
  grade,
  board,
  markdown,
}: AiContentViewerProps) {
  const [stage, setStage] = useState<Stage>('overview');
  const { intro, sections } = useMemo(() => parseMarkdown(markdown), [markdown]);

  const stages: { key: Stage; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'notes', label: 'Notes' },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Link
          href="/student/learning-map"
          className="text-sm font-semibold text-[#534AB7] hover:underline dark:text-[#A69DFF]"
        >
          Back to Map
        </Link>
      </div>

      <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {subject} {grade ? `· Grade ${grade}` : ''} {board ? `· ${board.toUpperCase()}` : ''}
          <span className="ml-2 rounded bg-[#534AB7]/10 px-1.5 py-0.5 text-[#534AB7]">AI Draft</span>
        </p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{topic}</h1>

        {/* Stage tabs: Overview | Notes | Practice */}
        <div className="mt-4 flex gap-1 rounded-xl bg-gray-100 dark:bg-slate-800 p-1">
          {stages.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStage(s.key)}
              className={`min-h-[36px] flex-1 rounded-lg text-sm font-semibold transition ${
                stage === s.key
                  ? 'bg-white dark:bg-slate-700 text-[#534AB7] shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {s.label}
            </button>
          ))}
          <Link
            href="/student/learning-map"
            className="min-h-[36px] flex-1 rounded-lg text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 flex items-center justify-center"
          >
            Practice
          </Link>
        </div>

        {stage === 'overview' && (
          <section className="mt-5">
            {intro ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                <MarkdownBlock text={intro} />
              </div>
            ) : sections[0] ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{sections[0].heading}</h2>
                <MarkdownBlock text={sections[0].body} />
              </div>
            ) : (
              <p className="text-sm text-gray-500">No overview available.</p>
            )}

            <div className="mt-4 rounded-xl border border-[#534AB7]/20 bg-[#EEEDFE] p-4 dark:bg-[#534AB7]/10">
              <p className="text-sm font-semibold text-[#534AB7]">Ready to dive deeper?</p>
              <p className="mt-1 text-sm text-[#534AB7]/80">Switch to Notes to read the full content.</p>
              <button
                type="button"
                onClick={() => setStage('notes')}
                className="mt-3 min-h-[44px] rounded-xl bg-[#534AB7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4238a3]"
              >
                Read Notes
              </button>
            </div>
          </section>
        )}

        {stage === 'notes' && (
          <section className="mt-5 space-y-4">
            {sections.length > 0 ? (
              sections.map((section, i) => (
                <div key={i} className="rounded-xl border border-gray-200 p-4 dark:border-slate-800">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{section.heading}</h2>
                  <MarkdownBlock text={section.body} />
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-gray-200 p-4 dark:border-slate-800">
                <MarkdownBlock text={markdown} />
              </div>
            )}

            <aside className="rounded-xl border border-[#1D9E75]/20 bg-[#EAF3DE] p-4 dark:bg-[#1D9E75]/10">
              <p className="text-sm font-semibold text-[#1D9E75]">Study Buddy Hint</p>
              <p className="mt-1 text-sm text-[#1D9E75]">Take it step by step and verify each part.</p>
            </aside>
          </section>
        )}
      </article>
    </div>
  );
}
