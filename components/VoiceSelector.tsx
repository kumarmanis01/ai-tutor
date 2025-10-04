'use client';
import React, { useState } from 'react';

const voices = ['alloy', 'verse', 'bright'];

export default function VoiceSelector() {
  const [voice, setVoice] = useState('alloy');

  async function playVoice(text: string) {
    const res = await fetch('/api/ai/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play();
  }

  return (
    <div className="flex gap-2 items-center">
      <select
        value={voice}
        onChange={(e) => setVoice(e.target.value)}
        className="border rounded p-2"
      >
        {voices.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
      <button
        onClick={() => playVoice('Hello! I am your AI Tutor.')}
        className="px-3 py-1 bg-purple-600 text-white rounded"
      >
        🔊 Test
      </button>
    </div>
  );
}
