// components/Chat/ChatBot.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from "react";
import MessageBubble, { Message } from "./MessageBubble";
import Controls from "./Controls";
import { Speech } from "@/lib/speech";
import { useLocalStorage } from "@/hooks/useLocalStorage";

/**
 * ChatBot component (Phase 2)
 * Responsibilities:
 * - Manage UI state + persistence (localStorage hook)
 * - Orchestrate speech (play/stop) via lib/speech (swapable)
 * - Keep UI presentational components small and dumb
 *
 * SOLID: Single responsibility, small functions, easy to test/replace.
 */

const STORAGE_KEY = "chat-history-v2";
const GUEST_COUNT_KEY = "guest-question-count-v2";
const MAX_GUEST_QUESTIONS = 3;

export default function ChatBot() {
  // Persist messages across browser sessions (Phase 2 requirement)
  const [messages, setMessages] = useLocalStorage<Message[]>(STORAGE_KEY, []);
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useLocalStorage<number>("settings-volume", 1);
  const [langCode, setLangCode] = useLocalStorage<string>("settings-lang", "en");
  const [guestCount, setGuestCount] = useLocalStorage<number>(GUEST_COUNT_KEY, 0);

  const recognizerRef = useRef<SpeechRecognition | null>(null);

  // safety: limit message array size to avoid localStorage blowup
  useEffect(() => {
    if (messages.length > 200) {
      setMessages((prev) => prev.slice(prev.length - 200));
    }
  }, [messages, setMessages]);

  // create recognizer lazily
  const createRecognizer = () => Speech.createRecognizer(langCode === "hi" ? "hi-IN" : "en-US");

  // handle mic toggle (client only)
  const handleMicToggle = () => {
    if (isListening) {
      recognizerRef.current?.stop();
      setIsListening(false);
      return;
    }
    const r = createRecognizer();
    if (!r) {
      alert("Speech recognition not supported in this browser");
      return;
    }
    r.onresult = (ev: SpeechRecognitionEvent) => {
      const found = ev.results[0][0].transcript;
      setInput(found);
    };
    r.onerror = () => {
      setIsListening(false);
    };
    r.onend = () => setIsListening(false);
    recognizerRef.current = r;
    r.start();
    setIsListening(true);
  };

  // TTS wrapper using Speech.speak
  const playText = (text: string) => {
    Speech.speak(text, { lang: langCode === "hi" ? "hi-IN" : "en-US", volume });
    setIsSpeaking(true);
    // listen for end (not all browsers fire onend reliably, but speech.synthesis events do)
    const handler = () => setIsSpeaking(false);
    window.speechSynthesis.onend = handler;
  };

  const stopText = () => {
    Speech.stop();
    setIsSpeaking(false);
  };

  // send message to API (Phase 1 behavior intact: only on user send)
  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;

    // guest usage tracking: local-only as requested
    if (guestCount >= MAX_GUEST_QUESTIONS) {
      // In phase 2 we simply block further asks (Phase3 will handle auth)
      alert("Guest limit reached. Please sign in to continue.");
      return;
    }

    // append user message immediately
    const userMsg: Message = { id: cryptoRandomId(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setGuestCount((c) => c + 1);

    try {
      // call server API (existing route)
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, language: langCode === "hi" ? "Hindi" : "English" }),
      });

      const data = await res.json();
      const replyText = data?.reply ?? (langCode === "hi" ? "क्षमा करें, उत्तर उपलब्ध नहीं।" : "Sorry, no reply.");
      const aiMsg: Message = { id: cryptoRandomId(), role: "assistant", content: replyText };
      setMessages((prev) => [...prev, aiMsg]);

      // Auto-play TTS for reply
      playText(replyText);
    } catch (err) {
      console.error("chat send error", err);
      const errMsg: Message = { id: cryptoRandomId(), role: "assistant", content: langCode === "hi" ? "त्रुटि हुई। पुनः प्रयास करें।" : "An error occurred. Please try again." };
      setMessages((prev) => [...prev, errMsg]);
    }
  };

  // helper id generator (crypto uses native RNG)
  const cryptoRandomId = () => {
    try {
      return (crypto.getRandomValues(new Uint32Array(2)).join("-"));
    } catch {
      return String(Date.now());
    }
  };

  // Play / Stop per message (local replay)
  const handlePlayMessage = (text: string) => {
    stopText();
    playText(text);
  };
  const handleStopMessage = () => {
    stopText();
  };

  // guest remaining count
  const guestRemaining = Math.max(0, MAX_GUEST_QUESTIONS - guestCount);

  return (
    <section className="flex flex-col h-[70vh]">
      {/* chat pane */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" role="log" aria-live="polite">
        {messages.length === 0 && (
          <div className="text-sm text-gray-500">
            {langCode === "hi" ? "नमस्ते — मैं आपका AI ट्यूटर हूँ! पूछिए।" : "Hi — I'm your AI tutor! Ask me anything."}
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            msg={m}
            onPlay={(text) => handlePlayMessage(text)}
            onStop={() => handleStopMessage()}
            isSpeaking={isSpeaking}
          />
        ))}
      </div>

      {/* controls */}
      <Controls
        input={input}
        onChange={setInput}
        onSend={sendMessage}
        onMicToggle={handleMicToggle}
        isListening={isListening}
        langCode={langCode}
        onLangChange={setLangCode}
        volume={volume}
        onVolumeChange={setVolume}
      />

      {/* guest info + accessibility hints */}
      <div className="mt-2 text-xs text-gray-600">
        {!messages.length ? null : (
          <div>
            {guestRemaining > 0 ? (
              <span>Guest mode — {guestRemaining} free question(s) left</span>
            ) : (
              <span className="text-red-600">Guest limit reached — sign in to continue (Phase 3)</span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
