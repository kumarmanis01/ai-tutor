"use client";
import React from "react";

export default function TutorModeToggle({
  mode,
  setMode,
}: {
  mode: string;
  setMode: (m: string) => void;
}) {
  return (
    <select
      value={mode}
      onChange={(e) => setMode(e.target.value)}
      className="border p-2 rounded"
    >
      <option value="friendly">Friendly</option>
      <option value="formal">Formal</option>
      <option value="tutor">Tutor</option>
    </select>
  );
}
