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
    function updateLayout() {
      try {
        const msgs = messagesContainerRef?.current;
        const ctrls = controlsRef.current;
        if (!msgs) return;
        const h = ctrls ? Math.ceil(ctrls.getBoundingClientRect().height) : 0;
        msgs.style.paddingBottom = `${Math.max(12, h + 12)}px`;

        // Align the fixed controls to the messages container so they don't span the whole viewport
        try {
          const msgsRect = msgs.getBoundingClientRect();
          if (ctrls) {
            ctrls.style.left = `${Math.max(0, msgsRect.left)}px`;
            ctrls.style.width = `${Math.max(0, msgsRect.width)}px`;
          }
        } catch {}
      } catch {}
    }

    updateLayout();
    window.addEventListener('resize', updateLayout);

    let ro: ResizeObserver | null = null;
    try {
      if (typeof ResizeObserver !== 'undefined' && controlsRef.current) {
        ro = new ResizeObserver(updateLayout);
        ro.observe(controlsRef.current);
      }
    } catch {}

    return () => {
      window.removeEventListener('resize', updateLayout);
      try {
        ro?.disconnect();
      } catch {}
    };
  }, [messagesContainerRef]);

  return (
    <div
      ref={controlsRef}
      className="fixed bottom-0 left-0 w-full bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-lg z-40"
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
