'use client';

import React, { useEffect, useRef } from 'react';
import Controls from './Controls';

export default function StickyControls({
  onSend,
  loading,
  isPremium,
  isValidSession,
  volume,
  setVolume,
  lang,
  setLang,
  subject,
  setSubject,
  messagesContainerRef,
}: {
  onSend: (msg: string) => void;
  loading: boolean;
  isPremium: boolean;
  isValidSession: boolean;
  volume: number;
  setVolume: (v: number) => void;
  lang: string;
  setLang: (l: string) => void;
  subject?: string;
  setSubject?: (s: string) => void;
  messagesContainerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const controlsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function updatePadding() {
      try {
        const msgs = messagesContainerRef?.current;
        const ctrls = controlsRef.current;
        if (!msgs) return;
        const h = ctrls ? Math.ceil(ctrls.getBoundingClientRect().height) : 0;
        msgs.style.paddingBottom = `${Math.max(12, h + 12)}px`;
      } catch {}
    }

    updatePadding();
    window.addEventListener('resize', updatePadding);

    let ro: ResizeObserver | null = null;
    try {
      if (typeof ResizeObserver !== 'undefined' && controlsRef.current) {
        ro = new ResizeObserver(updatePadding);
        ro.observe(controlsRef.current);
      }
    } catch {}

    return () => {
      window.removeEventListener('resize', updatePadding);
      try {
        ro?.disconnect();
      } catch {}
    };
  }, [messagesContainerRef]);

  return (
    <div
      ref={controlsRef}
      className="sticky bottom-0 w-full bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-lg"
    >
      <div className="max-w-full">
        <Controls
          onSend={onSend}
          loading={loading}
          isPremium={isPremium}
          isValidSession={isValidSession}
          volume={volume}
          setVolume={setVolume}
          lang={lang}
          setLang={setLang}
          subject={subject}
          setSubject={setSubject}
        />
      </div>
    </div>
  );
}
