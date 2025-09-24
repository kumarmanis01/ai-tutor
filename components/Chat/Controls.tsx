// components/Chat/Controls.tsx
"use client";

import { useState } from "react";

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
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          className="flex-1 rounded border px-3 py-2"
          disabled={loading}
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "..." : "Send"}
        </button>
      </form>
      <div className="text-xs text-gray-500 mt-1">
        {isValidSession ? (
          isPremium ? (
            <span>Premium: Unlimited questions</span>
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
