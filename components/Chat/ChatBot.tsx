// components/Chat/ChatBot.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import MessageBubble, { ChatMessage } from "./MessageBubble";
import Controls from "./Controls";
import { Speech } from "@/lib/speech";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useSession } from "next-auth/react";

/**
 * ChatBot
 * - Integrates Phase-2 UX features (mic, TTS, volume, language)
 * - Integrates auth: guest gets 3 local-only questions, after which UI blocks and prompts login
 * - Persists conversation locally for guests; persists to DB for logged-in users (handled server-side in Phase 3)
 */

const STORAGE_KEY = "ai-tutor:messages-v3";
const GUEST_KEY = "ai-tutor:guest-count";
const MAX_GUEST = 3;

export default function ChatBot() {
  const { data: session } = useSession();
  const [messages, setMessages] = useLocalStorage<ChatMessage[]>(STORAGE_KEY, []);
  const [input, setInput] = useState("");
  const [lang, setLang] = useLocalStorage<string>("ai-tutor:lang", "en");
  const [volume, setVolume] = useLocalStorage<number>("ai-tutor:volume", 1);
  const [guestCount, setGuestCount] = useLocalStorage<number>(GUEST_KEY, 0);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognizerRef = useRef<SpeechRecognition | null>(null);

  // utility: safe id
  const nextId = () => String(Date.now()) + "-" + Math.random().toString(36).slice(2, 8);

  // mic toggle using Speech.createRecognizer
  const toggleMic = () => {
    if (isListening) {
      recognizerRef.current?.stop();
      setIsListening(false);
      return;
    }
    const r = Speech.createRecognizer(lang === "hi" ? "hi-IN" : "en-US");
    if (!r) {
      alert(lang === "hi" ? "यह ब्राउज़र स्पीच रिकग्निशन का समर्थन नहीं करता।" : "Speech recognition not supported.");
      return;
    }
    r.onresult = (ev: SpeechRecognitionEvent) => {
      const transcript = ev.results[0][0].transcript;
      setInput(transcript);
    };
    r.onerror = () => setIsListening(false);
    r.onend = () => setIsListening(false);
    recognizerRef.current = r;
    r.start();
    setIsListening(true);
  };

  // TTS play / stop for local playback
  const playText = (text: string) => {
    Speech.stop();
    Speech.speak(text, { lang: lang === "hi" ? "hi-IN" : "en-US", volume });
    setIsSpeaking(true);
    // ensure onend resets state
    window.speechSynthesis.onend = () => setIsSpeaking(false);
  };
  const stopText = () => {
    Speech.stop();
    setIsSpeaking(false);
  };

  // guest check
  const canAsk = !!session?.user || guestCount < MAX_GUEST;

  // send message: maintains Phase2 behavior (append user immediately, then call server)
  const send = async () => {
    const text = input.trim();
    if (!text) return;
    if (!canAsk) {
      alert(lang === "hi" ? "नि:शुल्क सीमा समाप्त। कृपया लॉगिन करें।" : "Guest limit reached. Please sign in.");
      return;
    }

    const userMsg: ChatMessage = { id: nextId(), role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setInput("");

    if (!session?.user) setGuestCount((c) => c + 1);

    // Build messages context for server: last N messages (client memory)
    const lastContext = [...messages, userMsg].slice(-10).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: lastContext, language: lang === "hi" ? "Hindi" : "English" }),
      });
      const body = await res.json();
      const reply = body?.reply ?? (lang === "hi" ? "क्षमा करें, उत्तर उपलब्ध नहीं।" : "Sorry — no reply.");
      const aiMsg: ChatMessage = { id: nextId(), role: "assistant", content: reply };
      setMessages((m) => [...m, aiMsg]);

      // Auto-play
      playText(reply);

      // If logged-in, optionally send recent messages to server to persist (Phase3)
      if (session?.user) {
        // Best-effort; ignore errors (non-blocking)
        fetch("/api/profile/save-chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [userMsg, aiMsg] }) }).catch(() => {});
      }
    } catch (err) {
      console.error("send error", err);
      const errMsg: ChatMessage = { id: nextId(), role: "assistant", content: lang === "hi" ? "त्रुटि हुई। कृपया पुनः प्रयास करें।" : "An error occurred. Please try again." };
      setMessages((m) => [...m, errMsg]);
    }
  };

  // replay specific message locally (no token)
  const replay = (text: string) => {
    stopText();
    playText(text);
  };

  // clear session (local only)
  const clearLocal = () => {
    setMessages([]);
    setGuestCount(0);
  };

  return (
    <div className="flex flex-col h-[70vh]">
      <div className="flex-1 overflow-y-auto p-4 space-y-3" role="log" aria-live="polite">
        {messages.length === 0 && <div className="text-gray-600">{lang === "hi" ? "नमस्ते — मैं आपका AI ट्यूटर हूँ!" : "Hi — I'm your AI tutor!"}</div>}
        {messages.map((m) => (
          <MessageBubble key={m.id} role={m.role} content={m.content} onSpeak={() => replay(m.content)} onStop={() => stopText()} isSpeaking={isSpeaking} />
        ))}
      </div>

      {/* Controls */}
      <Controls
        input={input}
        onChange={setInput}
        onSend={send}
        onMicToggle={toggleMic}
        isListening={isListening}
        lang={lang}
        onLangChange={setLang}
        volume={volume}
        onVolumeChange={setVolume}
      />

      {/* Footer: guest info, clear button */}
      <div className="mt-2 text-sm text-gray-600 flex items-center justify-between">
        <div>{!session ? (guestCount < MAX_GUEST ? `Guest — ${MAX_GUEST - guestCount} free question(s) left` : "Guest limit reached") : `Signed in`}</div>
        <div className="flex items-center gap-2">
          <button onClick={clearLocal} className="text-xs text-blue-600 hover:underline">Clear local</button>
        </div>
      </div>
    </div>
  );
}
