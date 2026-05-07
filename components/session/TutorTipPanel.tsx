'use client';
/**
 * FILE OBJECTIVE:
 * - Tutor Tip panel shown in session phases (sidebar on desktop, above content on mobile).
 * - Receives tipText from the phase for contextual guidance.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created as proper component (was a static placeholder)
 * - 2026-04-07 | claude | replace lightbulb emoji with Vidya avatar; rebrand label
 * - 2026-04-07 | claude | fix: ensure avatar uses object-cover to preserve aspect ratio
 */

import React, { useState } from 'react';
import Image from 'next/image';

interface TutorTipPanelProps {
  /** Contextual guidance shown to the student */
  tipText: string;
}

export function TutorTipPanel({ tipText }: TutorTipPanelProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-[#EEEDFE] dark:bg-[#534AB7]/10 border border-[#534AB7]/20 dark:border-[#534AB7]/30 rounded-xl p-4 flex items-start gap-3 h-fit">
      <Image
        src="/logos/vidya/vidya-avatar-64.png"
        alt="Teacher Vidya"
        width={32}
        height={32}
        className="flex-shrink-0 rounded-full mt-0.5 object-cover"
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-[#534AB7] dark:text-indigo-300 mb-0.5">
          Teacher Vidya
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{tipText}</p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors text-xs p-1"
        aria-label="Dismiss tip"
      >
        ✕
      </button>
    </div>
  );
}

export default TutorTipPanel;