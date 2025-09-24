"use client";
import React from "react";

const langs = ["English", "Hindi", "Tamil", "Bengali", "French", "Spanish"];

export default function LanguageSelector({ lang, setLang }: { lang: string; setLang: (s: string) => void }) {
  return (
    <select value={lang} onChange={(e) => setLang(e.target.value)} className="border p-2 rounded">
      {langs.map((l) => (
        <option key={l} value={l}>{l}</option>
      ))}
    </select>
  );
}
