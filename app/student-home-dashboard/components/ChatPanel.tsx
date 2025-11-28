"use client";

import React from "react";

interface ChatMessage {
  id: string;
  from: "user" | "ai";
  text: string;
}

interface ChatPanelProps {
  messages: ChatMessage[];
}

const ChatPanel: React.FC<ChatPanelProps> = ({ messages }) => {
  return (
    <div className="bg-background/50 border border-border rounded-lg p-3 max-w-4xl mx-auto mb-4">
      <div className="space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">Ask the AI tutor a question — replies appear here.</p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`py-2 px-3 rounded-md max-w-[80%] ${m.from === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-card text-foreground"}`}
          >
            <div className="text-sm whitespace-pre-wrap">{m.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatPanel;
