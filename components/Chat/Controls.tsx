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
  volume,
  setVolume,
  lang,
  setLang,
}: {
  onSend: (msg: string) => void;
  loading: boolean;
  isPremium: boolean;
  isValidSession: boolean;
  todaysCount: number;
  volume: number;
  setVolume: (v: number) => void;
  lang: string;
  setLang: (l: string) => void;
}) {
  const [input, setInput] = useState("");
  const [speechError, setSpeechError] = useState<string>("");

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
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50 flex items-center justify-center"
          disabled={loading}
          aria-label="Send"
        >
          {loading ? (
            "..."
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          )}
        </button>
      </form>
      {speechError && (
        <div className="text-xs text-red-500 mt-2">{speechError}</div>
      )}
      <div className="flex items-center gap-2 mt-4 justify-end">
        <label htmlFor="volume-bar" className="text-sm">
          Volume:
        </label>
        <input
          id="volume-bar"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="w-32"
        />
        <span className="text-xs text-gray-600">
          {Math.round(volume * 100)}%
        </span>
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {isValidSession ? (
          isPremium ? (
            <span className="text-emerald-600 font-semibold">
              Thank you for being a premium member! Enjoy unlimited questions 🎉
            </span>
          ) : (
            <span>Free tier: {remaining} / 3 left today</span>
          )
        ) : (
          <span className="text-red-500">
            Session expired. Please log in again.
          </span>
        )}
      </div>
    </div>
  );
}
