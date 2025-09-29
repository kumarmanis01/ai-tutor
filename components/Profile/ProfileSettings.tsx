// components/Profile/ProfileSettings.tsx
"use client";
import React, { useEffect, useState } from "react";

export default function ProfileSettings() {
  const [language, setLanguage] = useState("en");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data?.language) setLanguage(data.language);
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language }),
    });
    if (res.ok) setStatus("Saved");
    else setStatus("Error");
    setTimeout(() => setStatus(null), 2000);
  };

  return (
    <div className="p-4 bg-white rounded shadow">
      <h3 className="font-semibold mb-2">Profile</h3>
      <div className="mb-2">
        <label className="block text-sm mb-1">Preferred language</label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="en">English</option>
          <option value="hi">हिन्दी</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button
          onClick={save}
          className="px-3 py-2 bg-blue-600 text-white rounded"
        >
          Save
        </button>
        {status && <div className="text-sm">{status}</div>}
      </div>
    </div>
  );
}
