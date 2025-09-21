// lib/speech.ts
/**
 * Lightweight speech wrapper:
 * - encapsulates browser speechSynthesis and SpeechRecognition
 * - provides a simple interface that can be swapped for cloud providers
 *
 * Implementation goal: single responsibility, easy to replace.
 */

export type TTSOptions = {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
};

export const Speech = {
  speak: (text: string, opts?: TTSOptions) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = opts?.lang ?? "en-US";
    if (opts?.rate) u.rate = opts.rate;
    if (opts?.pitch) u.pitch = opts.pitch;
    if (opts?.volume) u.volume = opts.volume;
    window.speechSynthesis.speak(u);
    return true;
  },

  stop: () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
  },

  createRecognizer: (lang = "en-US") => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return null;
    const recognition: SpeechRecognition = new SR();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    return recognition;
  },
};
