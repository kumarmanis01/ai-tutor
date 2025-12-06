// components/ExportButtons.tsx
"use client";
import React, { useState } from "react";
import { toast } from '@/lib/toast';
import { logger } from '@/lib/logger';

/**
 * Props:
 *  - messages: [{ role, content }]
 */
export default function ExportButtons({
  messages,
}: {
  messages: { role: string; content: string }[];
}) {
  const [loading, setLoading] = useState(false);

  async function download(format: "pdf" | "text") {
    setLoading(true);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "AI_Tutor_Chat", messages, format }),
      });

      if (!res.ok) {
        throw new Error("Export failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ai_tutor_chat.${format === "pdf" ? "pdf" : "txt"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      logger.error(`export error: ${String(err)}`, { className: 'ExportButtons', methodName: 'download' });
      toast("Export failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => download("pdf")}
        disabled={loading || messages.length === 0}
        className="px-3 py-1 bg-sky-600 text-white rounded"
      >
        Export PDF
      </button>
      <button
        onClick={() => download("text")}
        disabled={loading || messages.length === 0}
        className="px-3 py-1 bg-gray-200 rounded"
      >
        Export Text
      </button>
    </div>
  );
}
