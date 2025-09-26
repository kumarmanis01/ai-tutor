// components/Chat/Controls.tsx
"use client";

import { useState } from "react";
import LanguageSelector from "../LanguageSelector";
import SpeechInput from "./SpeechInput";

export default function Controls({
  onSend,
  loading,
  isPremium,
  isValidSession,
  todaysCount,
}: {
  onSend: (msg: string) => void;
  loading: boolean;
  isPremium: boolean;
  isValidSession: boolean;
  todaysCount: number;
}) {
  const [input, setInput] = useState("");
  const [lang, setLang] = useState("English");
  const [speechError, setSpeechError] = useState<string>("");

  // ...existing code...

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSend(input.trim());
    setInput("");
  };

  const remaining = isPremium ? "∞" : Math.max(0, 3 - todaysCount);

  return (
    <div className="border-t p-3">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="mr-2">
          <LanguageSelector lang={lang} setLang={setLang} />
        </div>
        <SpeechInput
          value={input}
          setValue={setInput}
          lang={lang}
          disabled={loading}
          onError={setSpeechError}
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "..." : "Send"}
        </button>
      </form>
      {speechError && (
        <div className="text-xs text-red-500 mt-2">{speechError}</div>
      )}
      <div className="text-xs text-gray-500 mt-1">
        {isValidSession ? (
          isPremium ? (
            <span className="text-emerald-600 font-semibold">Thank you for being a premium member! Enjoy unlimited questions 🎉</span>
          ) : (
            <span>
              Free tier: {remaining} / 3 left today
            </span>
          )
        ) : (
          <span className="text-red-500">Session expired. Please log in again.</span>
        )}
      </div>
    </div>
  );
}
