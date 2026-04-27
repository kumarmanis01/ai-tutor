/**
 * FILE OBJECTIVE:
 * - Board-specific content section: tabbed carousel showing CBSE / ICSE / State Board
 *   value propositions and subject coverage so students self-identify their board.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/BoardSpecificSection.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T00:00:00Z | copilot | created for v3 landing page
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';

type BoardKey = 'cbse' | 'icse' | 'state';

interface BoardData {
  key: BoardKey;
  label: string;
  tagline: string;
  highlights: string[];
  subjects: string[];
  classes: string;
  ctaText: string;
}

const BOARDS: BoardData[] = [
  {
    key: 'cbse',
    label: 'CBSE',
    tagline: 'Central Board of Secondary Education',
    highlights: [
      'NCERT-aligned notes and practice',
      'Chapter-wise question banks',
      'CBSE sample paper pattern mock tests',
      'Weak chapter detection from board pattern',
    ],
    subjects: ['Mathematics', 'Science', 'Social Science', 'English', 'Hindi', 'Computer Science'],
    classes: 'Classes 6-12',
    ctaText: 'Start CBSE Prep Free',
  },
  {
    key: 'icse',
    label: 'ICSE',
    tagline: 'Indian Certificate of Secondary Education',
    highlights: [
      'ICSE/ISC syllabus-aligned content',
      'Literature and language support',
      'ICSE past paper question bank',
      'Separate Physics, Chemistry, Biology tracks',
    ],
    subjects: ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English Literature', 'History & Civics'],
    classes: 'Classes 6-12',
    ctaText: 'Start ICSE Prep Free',
  },
  {
    key: 'state',
    label: 'State Boards',
    tagline: 'Maharashtra, UP, Tamil Nadu, Karnataka & more',
    highlights: [
      'State-specific syllabus covered',
      'Regional language explanations',
      'Board exam pattern questions',
      'Local textbook chapter alignment',
    ],
    subjects: ['Mathematics', 'Science', 'Social Studies', 'English', 'Regional Language', 'General Knowledge'],
    classes: 'Classes 6-12',
    ctaText: 'Start State Board Prep Free',
  },
];

const BoardSpecificSection = () => {
  const [activeBoard, setActiveBoard] = useState<BoardKey>('cbse');

  const data = BOARDS.find((b) => b.key === activeBoard) ?? BOARDS[0];

  return (
    <section id="board-prep" className="py-12 md:py-16 bg-[#EEEDFE]/40">
      <div className="mx-auto px-4 md:px-6 lg:px-8 max-w-7xl">
        <div className="text-center mb-8 md:mb-10">
          <h2 className="font-headline font-bold text-3xl md:text-4xl text-secondary mb-2">
            Built for Your Board
          </h2>
          <p className="font-accent text-xl text-[#534AB7]">आपके बोर्ड के लिए बनाया गया</p>
        </div>

        {/* Board tab selector */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-xl border border-border bg-background p-1 gap-1">
            {BOARDS.map((board) => (
              <button
                key={board.key}
                onClick={() => setActiveBoard(board.key)}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 min-h-[44px] ${
                  activeBoard === board.key
                    ? 'bg-[#534AB7] text-white shadow'
                    : 'text-secondary hover:bg-muted'
                }`}
              >
                {board.label}
              </button>
            ))}
          </div>
        </div>

        {/* Board content */}
        <div className="grid md:grid-cols-2 gap-8 items-start max-w-4xl mx-auto">
          {/* Left: highlights */}
          <div>
            <h3 className="font-headline font-bold text-xl text-secondary mb-1">{data.label}</h3>
            <p className="font-body text-sm text-muted-foreground mb-4">{data.tagline} &middot; {data.classes}</p>
            <ul className="space-y-3">
              {data.highlights.map((h) => (
                <li key={h} className="flex items-start gap-3">
                  <span className="text-[#1D9E75] mt-0.5" aria-hidden="true">✓</span>
                  <span className="font-body text-sm text-secondary">{h}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: subject chips + CTA */}
          <div>
            <p className="font-headline font-bold text-base text-secondary mb-3">Subjects covered</p>
            <div className="flex flex-wrap gap-2 mb-6">
              {data.subjects.map((s) => (
                <span key={s} className="px-3 py-1 bg-[#EEEDFE] text-[#534AB7] text-sm font-medium rounded-full">
                  {s}
                </span>
              ))}
            </div>
            <Link
              href="https://app.spinzyacademy.com/register"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[48px] bg-[#534AB7] text-white font-semibold rounded-lg hover:bg-[#433ba0] transition-all text-base"
            >
              {data.ctaText} &rarr;
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BoardSpecificSection;
