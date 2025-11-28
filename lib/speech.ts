// Lightweight reusable speech recognition controller

type SpeechRecognitionEvent = {
  resultIndex: number;
  // Use a permissive type for results to avoid coupling to DOM lib types
  results: any;
};

type SpeechRecognitionErrorEvent = { error: string };

type SpeechRecognitionType = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};

export type SpeechController = {
  start: () => void;
  stop: () => void;
};

export function createSpeechController(opts: {
  lang?: string;
  onInterim?: (text: string) => void;
  onFinal?: (text: string, detectedLang?: string) => void;
  onError?: (msg: string) => void;
}): SpeechController | null {
  const { lang = 'en-US', onInterim, onFinal, onError } = opts;

  const globalAny = window as any;
  const SpeechRecognitionClass = globalAny.SpeechRecognition || globalAny.webkitSpeechRecognition;
  if (!SpeechRecognitionClass) {
    if (onError) onError('Speech recognition not supported in this browser');
    return null;
  }

  // Create recognition instance and cast to our typed interface
  const recognition = new (SpeechRecognitionClass as any)() as SpeechRecognitionType;
  recognition.lang = lang;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    let final = '';
    let interim = '';
    let detectedLang: string | undefined;
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const result: any = event.results[i];
      const item = result[0];
      // try to extract detected language from browser result if available
      if (!detectedLang && item && (item.lang || item.language)) {
        detectedLang = (item.lang || item.language) as string;
      }
      if (result.isFinal) {
        final += item.transcript;
      } else {
        interim += item.transcript;
      }
    }
    if (interim && onInterim) onInterim(interim);
    if (final && onFinal) onFinal(final, detectedLang || recognition.lang);
  };

  recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
    if (onError) {
      if (e.error === 'not-allowed') {
        onError('Microphone access denied');
      } else if (e.error === 'no-speech') {
        onError('No speech detected');
      } else {
        onError(`Speech error: ${e.error}`);
      }
    }
  };

  recognition.onend = () => {
    // no-op; callers manage lifecycle
  };

  return {
    start: () => recognition.start(),
    stop: () => recognition.stop(),
  };
}
// lib/speech.ts
export type TTSOptions = {
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
};

// Use 'unknown' for the type to avoid self-referencing error
declare global {
  interface Window {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  }
}

// Define a minimal type for speech recognition instance
type MinimalSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

/**
 * Speech helper — small adapter around browser APIs.
 * Swap this file with an external cloud provider wrapper without touching UI.
 */
export const Speech = {
  speak(text: string, opts?: TTSOptions) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = opts?.lang ?? 'en-US';
    if (opts?.rate !== undefined) u.rate = opts.rate;
    if (opts?.pitch !== undefined) u.pitch = opts.pitch;
    if (opts?.volume !== undefined) u.volume = opts.volume;
    window.speechSynthesis.speak(u);
    return true;
  },

  stop() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
  },

  createRecognizer(lang = 'en-US') {
    const SR =
      (
        window as Window & {
          SpeechRecognition?: new () => MinimalSpeechRecognition;
          webkitSpeechRecognition?: new () => MinimalSpeechRecognition;
        }
      ).SpeechRecognition ||
      (
        window as Window & {
          SpeechRecognition?: new () => MinimalSpeechRecognition;
          webkitSpeechRecognition?: new () => MinimalSpeechRecognition;
        }
      ).webkitSpeechRecognition;
    if (!SR) return null;
    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    return rec;
  },
};
