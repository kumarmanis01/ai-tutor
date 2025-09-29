"use client";
import React from "react";

export default function SubjectSelector({
  subject,
  setSubject,
}: {
  subject: string;
  setSubject: (s: string) => void;
}) {
  return (
    <select
      value={subject}
      onChange={(e) => setSubject(e.target.value)}
      className="border rounded p-2"
    >
      <option value="general">General</option>
      <option value="math">Math</option>
      <option value="science">Science</option>
      <option value="coding">Coding</option>
    </select>
  );
}
