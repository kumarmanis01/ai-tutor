"use client";
/**
 * FILE OBJECTIVE:
 * - Display chat messages between user and AI tutor with professional styling,
 *   text-to-speech support, language indicators, and follow-up suggestions.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/dashboard/components/ChatPanel.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-XX | copilot | refactored with professional UI, animations, better message design
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

// AI Avatar Icon
const AIAvatarIcon = () => (
  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-md">
    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  </div>
);

// User Avatar Icon
const UserAvatarIcon = () => (
  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-md">
    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  </div>
);

// Play/Stop Icons
const PlayIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M15.536 8.464a5 5 0 010 7.072M12 6v12m6.364-10.364a9 9 0 010 12.728M6 15h3l4 5V4L9 9H6a2 2 0 00-2 2v2a2 2 0 002 2z" />
  </svg>
);

const StopIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

const ChatPanel: React.FC<ChatPanelProps> = ({ messages }) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const mapLangToEmoji = (lang?: string) => {
    if (!lang) return null;
    const t = String(lang).toLowerCase();
    if (t.startsWith('hi')) return { emoji: '🇮🇳', title: 'Hindi', code: 'HI' };
    if (t.startsWith('ta')) return { emoji: '🇮🇳', title: 'Tamil', code: 'TA' };
    if (t.startsWith('bn')) return { emoji: '🇧🇩', title: 'Bengali', code: 'BN' };
    if (t.startsWith('fr')) return { emoji: '🇫🇷', title: 'French', code: 'FR' };
    if (t.startsWith('es')) return { emoji: '🇪🇸', title: 'Spanish', code: 'ES' };
    if (t.startsWith('en')) return { emoji: '🇺🇸', title: 'English', code: 'EN' };
    return { emoji: '🏳️', title: lang, code: lang.slice(0, 2).toUpperCase() };
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
      logger.error('TTS play error', { className: 'ChatPanel', methodName: 'playTTS', error: String(err) });
    }
  };

  const handleStop = () => {
    try {
      Speech.stop();
    } catch {}
    setPlayingId(null);
  };

  // Empty state
  if (messages.length === 0) {
    return (
      <div className="bg-card/30 dark:bg-slate-800/30 backdrop-blur-sm border border-border/50 rounded-2xl p-6 max-w-4xl mx-auto mb-4">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Start a conversation</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Ask the AI tutor a question and get instant help with your studies!
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            एआई ट्यूटर से कोई सवाल पूछें! 📚
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card/30 dark:bg-slate-800/30 backdrop-blur-sm border border-border/50 rounded-2xl p-4 max-w-4xl mx-auto mb-4 shadow-sm">
      {/* Chat header */}
      <div className="flex items-center gap-2 pb-3 mb-3 border-b border-border/30">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-xs font-medium text-muted-foreground">
          {messages.length} message{messages.length !== 1 ? 's' : ''} in this conversation
        </span>
      </div>

      {/* Messages container */}
      <div ref={scrollRef} className="space-y-4 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
        {messages.map((m, index) => {
          const isUser = m.from === "user";
          const langInfo = mapLangToEmoji(m.language);
          const isPlaying = playingId === m.id;
          
          return (
            <div
              key={m.id}
              className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-slideIn`}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Avatar */}
              {isUser ? <UserAvatarIcon /> : <AIAvatarIcon />}
              
              {/* Message bubble */}
              <div className={`relative max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
                <div
                  className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    isUser
                      ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-tr-sm'
                      : 'bg-muted/50 dark:bg-slate-700/50 text-foreground rounded-tl-sm border border-border/30'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.text}</div>
                  
                  {/* AI message controls */}
                  {!isUser && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/20">
                      {/* TTS button */}
                      <button
                        onClick={() => (isPlaying ? handleStop() : handlePlay(m))}
                        aria-label={isPlaying ? 'Stop playback' : 'Play message'}
                        title={isPlaying ? 'Stop playback' : 'Listen to response'}
                        className={`p-1.5 rounded-lg transition-all ${
                          isPlaying 
                            ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' 
                            : 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20'
                        }`}
                      >
                        {isPlaying ? <StopIcon /> : <PlayIcon />}
                      </button>
                      
                      {/* Language badge */}
                      {langInfo && (
                        <span 
                          className="inline-flex items-center gap-1 px-2 py-1 bg-muted/50 rounded-full text-xs text-muted-foreground"
                          title={langInfo.title}
                        >
                          {langInfo.emoji} {langInfo.code}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Suggestions */}
                {!isUser && m.suggestions && m.suggestions.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      Follow-up questions:
                    </div>
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
                          className="px-3 py-1.5 bg-gradient-to-r from-blue-500/10 to-purple-500/10 hover:from-blue-500/20 hover:to-purple-500/20 border border-blue-500/20 rounded-full text-xs text-foreground transition-all hover:scale-105"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Styles */}
      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slideIn {
          animation: slideIn 0.3s ease-out forwards;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(100, 100, 100, 0.3);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(100, 100, 100, 0.5);
        }
      `}</style>
    </div>
  );
};

export default ChatPanel;
