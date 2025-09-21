// components/Chat/Controls.tsx
"use client";
import React from "react";

type Props = {
  input: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onMicToggle: () => void;
  isListening: boolean;
  lang: string;
  onLangChange: (l: string) => void;
  volume: number;
  onVolumeChange: (v: number) => void;
};

export default function Controls({ input, onChange, onSend, onMicToggle, isListening, lang, onLangChange, volume, onVolumeChange }: Props) {
  return (
    <div className="pt-3 border-t">
      <div className="flex items-center gap-3">
        <select aria-label="Language" value={lang} onChange={(e) => onLangChange(e.target.value)} className="p-2 border rounded">
          <option value="en">English</option>
          <option value="hi">हिंदी</option>
        </select>

        <input value={input} onChange={(e) => onChange(e.target.value)} className="flex-1 border rounded px-3 py-2" placeholder="Ask me..." />

        <button onClick={onSend} disabled={!input.trim()} className={`px-3 py-2 rounded ${input.trim() ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"}`} aria-label="Send">
          ✈️
        </button>

        <button onClick={onMicToggle} aria-pressed={isListening} className={`p-2 rounded ${isListening ? "bg-red-500 text-white" : "bg-gray-100"}`} aria-label="Toggle mic">
          🎤
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs">Volume</label>
          <input type="range" min={0} max={1} step={0.1} value={String(volume)} onChange={(e) => onVolumeChange(Number(e.target.value))} />
        </div>
        <div className="text-xs text-gray-500">Guest limit: 3 (local)</div>
      </div>
    </div>
  );
}
