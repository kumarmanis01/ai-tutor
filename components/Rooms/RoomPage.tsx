// components/Rooms/RoomPage.tsx
"use client";
import React, { useEffect, useRef, useState } from "react";
import ChatInput from "./ChatInput";

type Msg = { id: string; role: string; sender?: string; content: string; createdAt?: string };

export default function RoomPage({ roomId }: { roomId: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const esRef = useRef<EventSource | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // initial load
    fetch(`/api/rooms/${roomId}/messages`).then((r) => r.json()).then((d) => setMessages(d.messages ?? []));

    // subscribe SSE
    const es = new EventSource(`/api/rooms/${roomId}/stream`);
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data?.type === "message") {
          setMessages((m) => [...m, data.payload]);
          // scroll down
          setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }), 50);
        }
      } catch (err) {
        console.error("SSE parse", err);
      }
    };
    es.onerror = (err) => console.error("SSE error", err);
    esRef.current = es;
    return () => {
      es.close();
      esRef.current = null;
    };
  }, [roomId]);

  return (
    <div className="flex flex-col h-[70vh]">
      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3 border rounded mb-3">
        {messages.map((m) => (
          <div key={m.id} className={`p-2 rounded ${m.role === "user" ? "bg-blue-100 self-end" : "bg-gray-100 self-start"}`}>
            <div className="text-xs text-gray-500">{m.sender ?? (m.role === "assistant" ? "AI" : "Guest")}</div>
            <div>{m.content}</div>
          </div>
        ))}
      </div>

      <ChatInput roomId={roomId} onSent={(msg) => {
        // optimistic update already handled by SSE; we still append for speed if needed
        setMessages((m) => [...m, msg]);
      }} />
    </div>
  );
}
