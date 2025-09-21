// components/Chat/MessageBubble.tsx
import React from "react";

export type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

type Props = {
  role: "user" | "assistant";
  content: string;
  onSpeak?: () => void;
  onStop?: () => void;
  isSpeaking?: boolean;
};

export default function MessageBubble({ role, content, onSpeak, onStop, isSpeaking }: Props) {
  const isUser = role === "user";
  const containerClass = isUser ? "justify-end" : "justify-start";
  const bubbleClass = isUser ? "bg-[var(--user-bg)] text-white" : "bg-[var(--ai-bg)] text-black";

  return (
    <div className={`flex ${containerClass}`}>
      <div className={`max-w-[80%] px-3 py-2 rounded-lg ${bubbleClass} relative`}>
        <div>{content}</div>
        {!isUser && (onSpeak || onStop) && (
          <div className="absolute right-0 top-0 mt-1 mr-1 flex gap-1">
            {!isSpeaking ? (
              <button onClick={onSpeak} aria-label="Play reply" className="text-green-700 px-1">🔊</button>
            ) : (
              <button onClick={onStop} aria-label="Stop playback" className="text-red-600 px-1">⏹</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
