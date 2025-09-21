// components/Chat/Controls.tsx
import React from "react";
import ThemeToggle from "@/components/UI/ThemeToggle";

type Props = {
  input: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onMicToggle: () => void;
  isListening: boolean;
  langCode: string;
  onLangChange: (code: string) => void;
  volume: number;
  onVolumeChange: (v: number) => void;
};

const Controls: React.FC<Props> = ({
  input,
  onChange,
  onSend,
  onMicToggle,
  isListening,
  langCode,
  onLangChange,
  volume,
  onVolumeChange,
}) => {
  return (
    <div className="pt-3 border-t">
      <div className="flex items-center gap-3">
        <select
          aria-label="Select language"
          value={langCode}
          onChange={(e) => onLangChange(e.target.value)}
          className="p-2 border rounded"
        >
          <option value="en">English</option>
          <option value="hi">हिन्दी</option>
        </select>

        <input
          value={input}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ask your question..."
          className="flex-1 border rounded px-3 py-2 focus:outline-none"
          aria-label="Chat input"
        />

        <button
          onClick={onSend}
          disabled={!input.trim()}
          aria-label="Send message"
          title={!input.trim() ? "Type a message to send" : "Send"}
          className={`px-3 py-2 rounded-md ${input.trim() ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500 cursor-not-allowed"}`}
        >
          ✈️
        </button>

        <button
          onClick={onMicToggle}
          aria-pressed={isListening}
          aria-label="Toggle microphone"
          title="Toggle microphone"
          className={`p-2 rounded-md ${isListening ? "bg-red-500 text-white" : "bg-gray-100"}`}
        >
          🎤
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs">Volume</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={String(volume)}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            aria-label="Speech volume"
          />
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
};

export default Controls;
