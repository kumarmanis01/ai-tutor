"use client";

import React, { useState, useEffect } from "react";
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

  const mapLangToEmoji = (lang?: string) => {
    if (!lang) return null;
    const t = String(lang).toLowerCase();
    if (t.startsWith('hi')) return { emoji: '🇮🇳', title: 'Hindi' };
    if (t.startsWith('ta')) return { emoji: '🇮🇳', title: 'Tamil' };
    if (t.startsWith('bn')) return { emoji: '🇧🇩', title: 'Bengali' };
    if (t.startsWith('fr')) return { emoji: '🇫🇷', title: 'French' };
    if (t.startsWith('es')) return { emoji: '🇪🇸', title: 'Spanish' };
    if (t.startsWith('en')) return { emoji: '🇺🇸', title: 'English' };
    return { emoji: '🏳️', title: lang };
  };

  useEffect(() => {
    // Track suggestion shown events for analytics when messages change
    try {
      messages.forEach((m) => {
        if (m.from === 'ai' && m.suggestions && m.suggestions.length > 0) {
          try {
            analyticsClient.trackEvent('suggestion.shown', { messageId: m.id, count: m.suggestions.length });
          } catch {}
        }
      });
    } catch {}
  }, [messages]);

  const handlePlay = (m: ChatMessage) => {
    try {
      const lang = m.language || 'en-US';
      Speech.speak(m.text, { lang });
      setPlayingId(m.id);
    } catch (err) {
      console.error('TTS play error', err);
    }
  };

  const handleStop = () => {
    try {
      Speech.stop();
    } catch {}
    setPlayingId(null);
  };
  return (
    <div className="bg-background/50 border border-border rounded-lg p-3 max-w-4xl mx-auto mb-4">
      <div className="space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">Ask the AI tutor a question — replies appear here.</p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`py-2 px-3 rounded-md max-w-[80%] relative ${m.from === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-card text-foreground"}`}
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 text-sm whitespace-pre-wrap">{m.text}</div>
              {m.from === 'ai' && (
                <div className="ml-2">
                  <button
                    onClick={() => (playingId === m.id ? handleStop() : handlePlay(m))}
                    aria-label={playingId === m.id ? 'Stop playback' : 'Play message'}
                    title={playingId === m.id ? 'Stop playback' : 'Play message'}
                    className="text-sm text-muted-foreground p-1"
                  >
                    {playingId === m.id ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 9v6h4l5 4V5L9 9H5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Language badge */}
            {m.from === 'ai' && m.language && (
              (() => {
                const v = mapLangToEmoji(m.language);
                return (
                  <div className="absolute -top-2 -right-2 bg-muted text-xs text-muted-foreground border border-border px-2 py-0.5 rounded-full" title={v?.title}>
                    {v?.emoji}
                  </div>
                );
              })()
            )}

            {/* Render suggestions for AI replies */}
            {m.from === 'ai' && m.suggestions && m.suggestions.length > 0 && (
              <div className="mt-2 w-full">
                <div className="text-xs text-muted-foreground mb-1">Try one of these:</div>
                <div className="flex flex-wrap gap-2">
                  {m.suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        try {
                          analyticsClient.trackEvent('suggestion.clicked', { suggestion: s, messageId: m.id });
                        } catch {}
                        try {
                          window.dispatchEvent(new CustomEvent('chatSuggestionPicked', { detail: { messageId: m.id, suggestion: s } }));
                        } catch {}
                      }}
                      className="px-3 py-1 bg-white/10 border border-border rounded-full text-xs hover:bg-white/20"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatPanel;
