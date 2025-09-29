// components/Rooms/ChatInput.tsx
"use client";
import React, { useState } from "react";

export default function ChatInput({
  roomId,
  onSent,
}: {
  roomId: string;
  onSent?: (msg: any) => void;
}) {
  const [text, setText] = useState("");

  async function send() {
    if (!text.trim()) return;
    const payload = {
      sender: null,
      senderName: "Guest",
      role: "user",
      content: text,
    };
    const res = await fetch(`/api/rooms/${roomId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text, role: "user", sender: "Guest" }),
    });
    const data = await res.json();
    setText("");
    onSent?.(data.message);
  }

  return (
    <div className="flex gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Say something..."
        className="flex-1 border rounded p-2"
      />
      <button
        onClick={send}
        className="px-3 py-2 bg-blue-600 text-white rounded"
      >
        Send
      </button>
    </div>
  );
}
