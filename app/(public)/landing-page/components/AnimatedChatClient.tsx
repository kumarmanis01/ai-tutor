"use client";

import { useEffect, useRef, useState } from 'react';

const chatMessages = [
  {
    sender: 'vidya' as const,
    text: 'Before we start -- what do you already know about quadratic equations?',
  },
  {
    sender: 'student' as const,
    text: `I know it's ax² + bx + c = 0...`,
  },
  {
    sender: 'vidya' as const,
    text: "Perfect start! Now, if a=1, b=−5, c=6 -- what's the discriminant?",
  },
  {
    sender: 'student' as const,
    text: 'Is it b² − 4ac? So... 25 − 24 = 1?',
  },
  {
    sender: 'vidya' as const,
    text: 'Exactly right ✓  And what does D=1 tell you about the roots?',
  },
];

export default function AnimatedChatClient() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [replayKey, setReplayKey] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setReplayKey((k) => k + 1);
          }
        });
      },
      { threshold: 0.5 }
    );
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="max-w-sm mx-auto" ref={containerRef}>
      <p className="text-center text-sm font-semibold text-brand-primary mb-3 tracking-wide uppercase">
        This is how Teacher Vidya actually teaches
      </p>

      <div className="border border-border rounded-2xl bg-white dark:bg-gray-900 p-4 space-y-3 overflow-hidden">
        <div key={replayKey}>
          <p className="text-xs font-semibold text-brand-primary pl-1">Teacher Vidya</p>

          {chatMessages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.sender === 'student' ? 'justify-end' : 'justify-start'}`}
              style={{
                animation: `fadeInChat 0.4s ease both`,
                animationDelay: `${i * 1.2}s`,
                animationIterationCount: 1,
              }}
            >
              <div
                className={`max-w-[85%] px-3 py-2 text-sm leading-snug ${
                  msg.sender === 'vidya'
                    ? 'bg-brand-primary-bg text-brand-primary rounded-[4px_12px_12px_12px]'
                    : 'bg-brand-primary text-white rounded-[12px_4px_12px_12px]'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}

          <div
            className="flex justify-start"
            style={{
              animation: `fadeInChat 0.4s ease both`,
              animationDelay: `${chatMessages.length * 1.2}s`,
            }}
          >
            <div className="bg-brand-primary-bg rounded-[4px_12px_12px_12px] px-4 py-3 flex gap-1 items-center">
              <span className="w-2 h-2 rounded-full bg-brand-primary typing-dot [animation-delay:0s]" />
              <span className="w-2 h-2 rounded-full bg-brand-primary typing-dot [animation-delay:0.2s]" />
              <span className="w-2 h-2 rounded-full bg-brand-primary typing-dot [animation-delay:0.4s]" />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInChat {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes typingBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40%            { transform: translateY(-4px); opacity: 1; }
        }
        .typing-dot {
          animation: typingBounce 1.2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
