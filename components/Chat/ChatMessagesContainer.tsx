'use client';

import React from 'react';
import MessageBubble from './MessageBubble';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatMessagesContainer({
  currentMessages,
  messagesEndRef,
  containerRef,
  volume,
  lang,
}: {
  currentMessages: ChatMessage[];
  messagesEndRef: React.RefObject<HTMLDivElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  volume: number;
  lang: string;
}) {
  return (
    <div
      ref={containerRef}
      className="flex-1 h-full flex flex-col overflow-y-auto p-4 space-y-2 border-2 border-gray-200 dark:border-gray-700 shadow-sm rounded-lg bg-white dark:bg-gray-900"
      style={{ minHeight: 0, height: '100%' }}
    >
      {currentMessages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-gray-400 text-center">Ask your first question to get started</div>
        </div>
      ) : (
        currentMessages.map((msg) => (
          <MessageBubble
            key={msg.id}
            role={msg.role}
            content={msg.content}
            volume={volume}
            lang={lang}
          />
        ))
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
