// components/Chat/MessageBubble.tsx

import React, { useState, useRef } from "react";

export type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

type Props = {
  role: "user" | "assistant";
  content: string;
};

// Speaker SVG icon
const SpeakerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 8V12H7L11 16V4L7 8H3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15 8.5C15.8284 9.32843 15.8284 10.6716 15 11.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

// Stop SVG icon
const StopIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="5" width="10" height="10" rx="2" fill="currentColor" />
  </svg>
);

export default function MessageBubble({ role, content }: Props) {
  const isUser = role === "user";
  const containerClass = isUser ? "justify-end" : "justify-start";
  const bubbleClass = isUser ? "bg-[var(--user-bg)] text-white" : "bg-[var(--ai-bg)] text-black";
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [volume, setVolume] = useState(1); // 1 = max volume

  // Play message as speech
  const handleSpeak = () => {
    if (!content || !content.trim()) return;
    if (!window.speechSynthesis) {
      alert("Speech synthesis is not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new window.SpeechSynthesisUtterance(content);
    utter.lang = "en-US";
    utter.volume = volume;
    utter.onend = () => setIsSpeaking(false);
    utter.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utter);
    utterRef.current = utter;
  };

  // Stop speech playback
  const handleStop = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  return (
    <div className={`flex ${containerClass}`}>
      <div className={`max-w-[80%] px-3 py-2 rounded-lg ${bubbleClass} relative flex items-center gap-2`}>
        <span>{content}</span>
        <button
          onClick={isSpeaking ? handleStop : handleSpeak}
          aria-label={isSpeaking ? "Stop playback" : "Play message"}
          className={isSpeaking ? "text-red-600 px-1" : "text-green-700 px-1"}
          title={isSpeaking ? "Stop playback" : "Play message"}
        >
          {isSpeaking ? <StopIcon /> : <SpeakerIcon />}
        </button>
      </div>
    </div>
  );
}
