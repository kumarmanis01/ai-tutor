// lib/speech.ts
export type TTSOptions = {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
};

/**
 * Speech helper — small adapter around browser APIs.
 * Swap this file with an external cloud provider wrapper without touching UI.
 */
export const Speech = {
  speak(text: string, opts?: TTSOptions) {
    if (typeof window === "undefined" || !("speechSynthesis" in window))
      return false;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = opts?.lang ?? "en-US";
    if (opts?.rate !== undefined) u.rate = opts.rate;
    if (opts?.pitch !== undefined) u.pitch = opts.pitch;
    if (opts?.volume !== undefined) u.volume = opts.volume;
    window.speechSynthesis.speak(u);
    return true;
  },

  stop() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
  },

  createRecognizer(lang = "en-US") {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) return null;
    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    return rec;
  },
};
