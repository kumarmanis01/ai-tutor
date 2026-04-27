"use client";
/**
 * FILE OBJECTIVE:
 * - Responsive chat message display with clean bubbles.
 *   Compact on mobile, expanded on desktop with larger chat area.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/dashboard/components/ChatPanel.spec.ts
 *
 * EDIT LOG:
 * - 2025-01-23 | copilot | made responsive - larger chat area on desktop
 * - 2025-01-22 | copilot | simplified for mobile-first with cleaner message bubbles
 */
import { logger } from '@/lib/logger';
import React, { useState, useEffect, useRef } from "react";
import { Speech } from '@/lib/speech';
import analyticsClient from '@/lib/analyticsClient';

interface ChatMessage {
  id: string;
  from: "user" | "ai";
  text: string;
  language?: string;
  suggestions?: string[];
}

interface ChatPanelProps {
  messages: ChatMessage[];
}

const ChatPanel: React.FC<ChatPanelProps> = ({ messages }) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    try {
      messages.forEach((m) => {
        if (m.from === 'ai' && m.suggestions?.length) {
          try { analyticsClient.trackEvent('suggestion.shown', { messageId: m.id, count: m.suggestions.length }); } catch {}
        }
      });
    } catch {}
  }, [messages]);

  const handlePlay = (m: ChatMessage) => {
    try {
      Speech.speak(m.text, { lang: m.language || 'en-US' });
      setPlayingId(m.id);
    } catch (err) {
      logger.error('TTS error', { error: String(err) });
    }
  };

  const handleStop = () => {
    try { Speech.stop(); } catch {}
    setPlayingId(null);
  };

  // Empty state
  if (messages.length === 0) {
    return (
      <div className="bg-muted/30 dark:bg-slate-800/30 rounded-xl p-6 lg:p-10 text-center">
        <div className="text-3xl lg:text-5xl mb-2 lg:mb-4">💬</div>
        <p className="text-sm lg:text-base text-muted-foreground">Ask anything to start learning!</p>
        <p className="text-xs lg:text-sm text-muted-foreground mt-1">कुछ भी पूछें!</p>
      </div>
    );
  }

  return (
    <div className="bg-muted/20 dark:bg-slate-800/20 rounded-xl p-3 lg:p-4">
      <div ref={scrollRef} className="space-y-3 lg:space-y-4 max-h-72 lg:max-h-[500px] xl:max-h-[600px] overflow-y-auto">
        {messages.map((m) => {
          const isUser = m.from === "user";
          const isPlaying = playingId === m.id;
          
          return (
            <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] lg:max-w-[75%] ${isUser ? 'order-1' : ''}`}>
                {/* Message bubble */}
                <div className={`px-3 py-2 lg:px-4 lg:py-3 rounded-2xl text-sm lg:text-base ${
                  isUser
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-card dark:bg-slate-700 text-foreground rounded-bl-md border border-border/30'
                }`}>
                  <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                </div>
                
                {/* AI controls */}
                {!isUser && (
                  <div className="flex items-center gap-2 mt-1.5 lg:mt-2 px-1">
                    <button
                      onClick={() => isPlaying ? handleStop() : handlePlay(m)}
                      className={`p-1 lg:p-1.5 rounded-md text-xs lg:text-sm ${isPlaying ? 'text-red-500' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {isPlaying ? '⏹' : '🔊'}
                    </button>
                    {m.language && (
                      <span className="text-[10px] lg:text-xs text-muted-foreground">
                        {m.language.startsWith('hi') ? '🇮🇳' : '🇺🇸'}
                      </span>
                    )}
                  </div>
                )}
                
                {/* Suggestions */}
                {!isUser && m.suggestions?.length ? (
                  <div className="flex flex-wrap gap-1.5 lg:gap-2 mt-2 lg:mt-3">
                    {m.suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          try { analyticsClient.trackEvent('suggestion.clicked', { suggestion: s }); } catch {}
                          try { window.dispatchEvent(new CustomEvent('chatSuggestionPicked', { detail: { suggestion: s } })); } catch {}
                        }}
                        className="px-2.5 py-1 lg:px-3 lg:py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-full text-xs lg:text-sm active:scale-95 transition-all"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChatPanel;
