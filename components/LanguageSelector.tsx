"use client";
import React from "react";

const langs = ["English", "Hindi", "Tamil", "Bengali", "French", "Spanish"];

export default function LanguageSelector({ lang, setLang }: { lang: string; setLang: (s: string) => void }) {
  return (
    <select
      value={lang}
      onChange={(e) => {
      console.log("passed lang:", lang);
      console.log("Selected language:", e.target.value);
      setLang(e.target.value);
      }}
      className="border p-2 rounded"
    >
      {langs.map((l) => (
      <option key={l} value={l}>{l}</option>
      ))}
    </select>
  );
}
