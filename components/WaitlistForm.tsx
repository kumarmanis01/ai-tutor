// components/WaitlistForm.tsx
'use client';

import React, { useState } from "react";

/**
 * Simple waitlist form.
 * UI-only for Phase 2 — persists to localStorage so you can wire it to a server later.
 */
export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [ok, setOk] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    try {
      const ls = localStorage.getItem("ai-tutor:waitlist") || "[]";
      const arr = JSON.parse(ls);
      arr.push({ email, createdAt: new Date().toISOString() });
      localStorage.setItem("ai-tutor:waitlist", JSON.stringify(arr));
    } catch {
      // ignore
    }
    setOk(true);
    setEmail("");
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 rounded shadow">
      <h3 className="font-semibold mb-2">Join the waitlist</h3>
      {ok ? (
        <div className="text-green-600">Thanks — you'll be notified.</div>
      ) : (
        <>
          <input
            type="email"
            placeholder="Your email"
            className="border p-2 w-full rounded mb-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded">
            Join Waitlist
          </button>
        </>
      )}
    </form>
  );
}
