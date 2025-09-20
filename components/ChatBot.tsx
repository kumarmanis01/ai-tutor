"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Mic,
  MicOff,
  Play,
  Square,
  Volume2,
  Sun,
  Moon,
} from "lucide-react";
import { motion } from "framer-motion";

// Chat message type
type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("chatHistory");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [volume, setVolume] = useState(1);
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState("en-IN"); // ✅ Phase 1 language toggle

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Save chat history
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem("chatHistory", JSON.stringify(messages));
    }
  }, [messages]);

  // Mic toggle
  const handleMicToggle = () => {
    if (!isListening) {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = language; // ✅ respect dropdown language
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = event.results[0][0].transcript;
          setInput(transcript);
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsListening(false);
        };

        recognition.onend = () => setIsListening(false);

        recognition.start();
        recognitionRef.current = recognition;
        setIsListening(true);
      }
    } else {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
  };

  // Send message
  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // Fake AI delay
      await new Promise((res) => setTimeout(res, 1200));
      const aiMessage: Message = {
        role: "assistant",
        content:
          language === "hi-IN"
            ? `यह है उत्तर: ${userMessage.content}`
            : `Here’s the response to: ${userMessage.content}`,
      };
      setMessages((prev) => [...prev, aiMessage]);
    } finally {
      setLoading(false);
    }
  };

  // Play AI response
  const handlePlay = (text: string) => {
    if (isSpeaking) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.volume = volume;
    utterance.onend = () => setIsSpeaking(false);
    speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  // Stop AI speech
  const handleStop = () => {
    speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center p-4 transition-colors ${
        isDarkMode ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900"
      }`}
      style={{
        backgroundImage: "url('/background.jpg')", // Page background
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="w-full max-w-2xl bg-white/80 dark:bg-gray-800/80 rounded-2xl shadow-xl p-4 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <h1 className="text-xl font-bold">AI Tutor</h1>
          <div className="flex items-center space-x-3">
            {/* Language select */}
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="p-1 rounded border dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="en-IN">English</option>
              <option value="hi-IN">हिन्दी</option>
            </select>

            {/* Volume */}
            <div className="flex items-center space-x-1">
              <Volume2 className="w-5 h-5" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
              />
            </div>

            {/* Theme toggle */}
            <button onClick={() => setIsDarkMode((prev) => !prev)}>
              {isDarkMode ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-2 p-2">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-xs px-3 py-2 rounded-lg shadow ${
                  m.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-300 dark:bg-gray-600 text-black dark:text-white"
                }`}
              >
                {m.content}
              </div>
              {m.role === "assistant" && (
                <div className="ml-2 flex items-center">
                  {isSpeaking ? (
                    <button onClick={handleStop} className="text-red-600">
                      <Square className="w-5 h-5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePlay(m.content)}
                      className="text-green-600"
                    >
                      <Play className="w-5 h-5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex justify-start">
              <motion.div
                className="bg-gray-400 dark:bg-gray-500 rounded-full px-3 py-2"
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              >
                Typing...
              </motion.div>
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="flex items-center mt-2 space-x-2">
          {/* Mic button */}
          <motion.button
            onClick={handleMicToggle}
            animate={isListening ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 0.6, repeat: Infinity }}
            className="p-2 rounded-full bg-gray-200 dark:bg-gray-700"
          >
            {isListening ? (
              <Mic className="w-5 h-5 text-red-600" />
            ) : (
              <MicOff className="w-5 h-5" />
            )}
          </motion.button>

          {/* Text input */}
          <input
            className="flex-1 p-2 rounded-lg border dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            placeholder={
              language === "hi-IN"
                ? "अपना प्रश्न लिखें..."
                : "Type your question..."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />

          {/* Send button only visible when input has text */}
          {input.trim() && (
            <button
              onClick={handleSend}
              className="p-2 bg-blue-600 text-white rounded-full"
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
