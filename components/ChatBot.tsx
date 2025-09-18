"use client";

import React, { useState, useRef } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  speaking?: boolean;
}

export default function ChatBot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [isListening, setIsListening] = useState(false);

  // 🔊 Toggle Play / Stop speech
  const toggleSpeak = (index: number, text: string, lang: string) => {
    const isCurrentlySpeaking = messages[index].speaking;

    if (isCurrentlySpeaking && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      updateMessageSpeaking(index, false);
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang === "hi" ? "hi-IN" : "en-US";
      synthRef.current = utterance;

      utterance.onend = () => updateMessageSpeaking(index, false);
      window.speechSynthesis.speak(utterance);
      updateMessageSpeaking(index, true);
    }
  };

  const updateMessageSpeaking = (index: number, speaking: boolean) => {
    setMessages((prev) =>
      prev.map((m, i) => (i === index ? { ...m, speaking } : m))
    );
  };

  // 🎤 Mic input
  const toggleMic = () => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      alert("Speech recognition not supported in this browser");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = selectedLanguage === "hi" ? "hi-IN" : "en-US";
      recognition.interimResults = false;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    }
  };

  // 🚀 Send message
  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, language: selectedLanguage }),
      });

      const data = await res.json();
      const aiMessage: Message = { role: "assistant", content: data.reply };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Error getting reply." },
      ]);
    }
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center p-6"
      style={{
        backgroundImage:
          "url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?fit=crop&w=1600&q=80')",
      }}
    >
      <div className="max-w-2xl mx-auto bg-white shadow-xl rounded-lg flex flex-col h-[90vh]">
        <h1 className="text-xl font-bold p-4 border-b">AI Tutor</h1>

        {/* Language selector */}
        <div className="p-2 border-b">
          <select
            className="border p-2 rounded"
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
          >
            <option value="en">English</option>
            <option value="hi">हिंदी</option>
          </select>
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-xs p-3 rounded-lg relative ${
                  msg.role === "user"
                    ? "bg-blue-500 text-white self-end"
                    : "bg-gray-200 text-black self-start"
                }`}
              >
                {msg.content}

                {/* Play/Stop button for AI messages */}
                {msg.role === "assistant" && (
                  <button
                    className="absolute -right-8 top-1/2 transform -translate-y-1/2 text-xl"
                    onClick={() =>
                      toggleSpeak(i, msg.content, selectedLanguage)
                    }
                  >
                    {msg.speaking ? "⏹" : "🔊"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Input + Buttons */}
        <div className="p-3 border-t flex items-center">
          <input
            className="flex-1 border rounded p-2"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type or speak..."
          />

          {/* Send button (enabled only if text present) */}
          <button
            className={`ml-2 p-2 rounded ${
              input.trim()
                ? "bg-blue-500 text-white"
                : "bg-gray-300 text-gray-600 cursor-not-allowed"
            }`}
            onClick={handleSend}
            disabled={!input.trim()}
          >
            ✈️
          </button>

          {/* Mic button */}
          <button
            className={`ml-2 p-2 rounded ${
              isListening ? "bg-red-500 text-white" : "bg-gray-300"
            }`}
            onClick={toggleMic}
          >
            🎤
          </button>
        </div>
      </div>
    </div>
  );
}
