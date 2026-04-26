/**
 * FILE OBJECTIVE:
 * - S3.2: StreamingContent — renders AI-generated content blocks as they
 *   arrive via SSE. Supports partial rendering with "AI Draft" badge.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/content-generation/StreamingContent.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created S3.2 StreamingContent component
 */

'use client';

import React from 'react';

type ContentBlock = {
  type: 'intro' | 'section' | 'bullets' | 'example' | 'summary';
  title?: string;
  body?: string;
  items?: string[];
};

type StreamingContentProps = {
  topic: string;
  blocks: ContentBlock[];
  isStreaming: boolean;
};

function BlockRenderer({ block }: { block: ContentBlock }) {
  if (block.type === 'intro' || block.type === 'summary') {
    return (
      <div className="rounded-xl bg-[#EEEDFE] p-4">
        {block.title && (
          <h3 className="mb-1 text-sm font-semibold text-[#3C3489]">{block.title}</h3>
        )}
        {block.body && <p className="text-sm text-gray-700">{block.body}</p>}
      </div>
    );
  }

  if (block.type === 'bullets' && block.items && block.items.length > 0) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-4">
        {block.title && (
          <h3 className="mb-2 text-sm font-semibold text-gray-800">{block.title}</h3>
        )}
        <ul className="space-y-1.5 pl-4">
          {block.items.map((item, idx) => (
            // Key is stable within a block
            // eslint-disable-next-line react/no-array-index-key
            <li key={idx} className="list-disc text-sm text-gray-700">
              {item}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (block.type === 'example') {
    return (
      <div className="rounded-xl border border-[#1D9E75]/30 bg-[#EAF3DE] p-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#1D9E75]">
          Example
        </span>
        {block.title && (
          <h3 className="mt-1 text-sm font-semibold text-gray-800">{block.title}</h3>
        )}
        {block.body && <p className="mt-1 text-sm text-gray-700">{block.body}</p>}
      </div>
    );
  }

  // Generic section
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      {block.title && (
        <h3 className="mb-1 text-sm font-semibold text-gray-800">{block.title}</h3>
      )}
      {block.body && <p className="text-sm text-gray-700">{block.body}</p>}
    </div>
  );
}

/**
 * S3.2 — Renders content blocks as they arrive via SSE.
 * Shows an "AI Draft — pending review" badge while streaming.
 */
export function StreamingContent({ topic, blocks, isStreaming }: StreamingContentProps) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      {/* Header with AI Draft badge */}
      <div className="mb-4 flex flex-wrap items-start gap-2">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-900">{topic}</h2>
          <p className="text-sm text-gray-500">AI-generated study notes</p>
        </div>
        <span className="rounded-full bg-[#FAEEDA] px-3 py-1 text-xs font-semibold text-[#BA7517]">
          AI Draft — pending review
        </span>
      </div>

      {/* Content blocks */}
      <div className="space-y-4">
        {blocks.map((block, idx) => (
          // Blocks are appended; index is stable for this render
          // eslint-disable-next-line react/no-array-index-key
          <BlockRenderer key={idx} block={block} />
        ))}
      </div>

      {/* Streaming indicator */}
      {isStreaming && (
        <div className="mt-4 flex items-center gap-2 text-sm text-[#534AB7]">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#534AB7]" />
          More content arriving…
        </div>
      )}

      {/* Completed state */}
      {!isStreaming && blocks.length > 0 && (
        <div className="mt-6 rounded-xl bg-[#EAF3DE] p-3 text-center text-sm font-medium text-[#1D9E75]">
          ✅ Notes generated! A teacher will review them soon.
        </div>
      )}
    </div>
  );
}

export default StreamingContent;
