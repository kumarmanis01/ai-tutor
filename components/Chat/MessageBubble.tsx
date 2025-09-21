// components/Chat/MessageBubble.tsx
import React from "react";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type Props = {
  msg: Message;
  onPlay?: (text: string) => void;
  onStop?: () => void;
  isSpeaking?: boolean;
};

const MessageBubble: React.FC<Props> = ({ msg, onPlay, onStop, isSpeaking }) => {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`} role="listitem">
      <div
        className={`max-w-[78%] px-3 py-2 rounded-lg text-sm leading-6 ${
          isUser ? "bg-[var(--user-bg)] text-[var(--user-text)]" : "bg-[var(--ai-bg)] text-[var(--ai-text)]"
        }`}
      >
        <div>{msg.content}</div>

        {!isUser && (onPlay || onStop) && (
          <div className="mt-2 flex items-center gap-2">
            {!isSpeaking ? (
              <button
                aria-label="Play reply"
                onClick={() => onPlay?.(msg.content)}
                className="text-green-700 hover:underline focus:outline-none"
              >
                🔊 Play
              </button>
            ) : (
              <button aria-label="Stop playback" onClick={() => onStop?.()} className="text-red-700 hover:underline focus:outline-none">
                ⏹ Stop
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
