// components/WaitlistForm.tsx
"use client";

import { useState } from "react";

export default function WaitlistForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [ok, setOk] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    // Phase1: just capture locally; you can wire to Google Sheets or Airtable later
    console.log("waitlist:", { name, email });
    setOk(true);
    setName("");
    setEmail("");
  }

  return (
    <form onSubmit={submit} className="bg-white p-4 rounded border">
      <h3 className="font-semibold mb-2">Join waitlist</h3>

      {ok ? (
        <div className="text-green-600">Thanks — we'll notify you!</div>
      ) : (
        <>
          <input
            placeholder="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border p-2 mb-2 rounded"
          />
          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border p-2 mb-2 rounded"
            type="email"
            required
          />
          <button className="bg-green-600 text-white px-4 py-2 rounded">Join</button>
        </>
      )}
    </form>
  );
}
