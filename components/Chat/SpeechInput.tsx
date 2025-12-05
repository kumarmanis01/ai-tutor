import React, { useState, useRef } from 'react';
import { toast } from '@/lib/toast';

type SpeechRecognitionEvent = {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};

type SpeechRecognitionErrorEvent = {
  error: string;
};

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

export default function SpeechInput({
  value,
  setValue,
  lang,
  disabled,
  onError,
}: {
  value: string;
  setValue: (s: string) => void;
  lang: string;
  disabled?: boolean;
  onError?: (msg: string) => void;
}) {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  // use global toast helper instead of local state
  const recognitionRef = useRef<SpeechRecognitionType | null>(null);

  // Mic SVG icon
  function MicIcon() {
    return (
      <svg
        width="22"
        height="22"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="8" y="4" width="4" height="8" rx="2" fill="currentColor" />
        <path d="M10 16V18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path
          d="M6 12C6 14.2091 7.79086 16 10 16C12.2091 16 14 14.2091 14 12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  // Stop SVG icon
  function StopIcon() {
    return (
      <svg
        width="22"
        height="22"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="5" y="5" width="10" height="10" rx="2" fill="currentColor" />
      </svg>
    );
  }

  const handleMic = () => {
    if (onError) onError('');
    // Use 'any' to avoid TS construct signature error and lint error
    const SpeechRecognitionClass =
      (
        window as Window & {
          SpeechRecognition?: new () => SpeechRecognitionType;
          webkitSpeechRecognition?: new () => SpeechRecognitionType;
        }
      ).SpeechRecognition ||
      (
        window as Window & {
          SpeechRecognition?: new () => SpeechRecognitionType;
          webkitSpeechRecognition?: new () => SpeechRecognitionType;
        }
      ).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      if (onError) {
        onError(
          'Speech recognition is not supported in this browser. Try Chrome or Edge, and check microphone permissions.',
        );
      }
      // Dispatch a global toast
      try {
        toast('Speech recognition is not supported in this browser.');
      } catch {}
      return;
    }
    // Use 'as any' to avoid TS2351 error and satisfy lint rules
    const recognition = new SpeechRecognitionClass() as SpeechRecognitionType;
    const langMap: Record<string, string> = {
      English: 'en-US',
      Hindi: 'hi-IN',
      Tamil: 'ta-IN',
      Bengali: 'bn-IN',
      French: 'fr-FR',
      Spanish: 'es-ES',
    };
    recognition.lang = langMap[lang] || 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    setIsListening(true);
    setInterimTranscript('');
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let final = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (interim) {
        setInterimTranscript(interim);
      }
      if (final) {
        setValue(final);
        setInterimTranscript('');
        setIsListening(false);
      }
    };
    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      setIsListening(false);
      setInterimTranscript('');
      let message = 'Speech recognition error';
      if (e.error === 'not-allowed') {
        message =
          'Microphone access denied. Please allow microphone permissions in your browser settings.';
      } else if (e.error === 'no-speech') {
        message = 'No speech detected. Please try again and speak clearly.';
      } else if (e.error === 'audio-capture') {
        message = 'No microphone found. Please connect a microphone and try again.';
      } else if (e.error) {
        message = `Speech recognition error: ${e.error}`;
      }
      if (onError) onError(message);
      try {
        toast(message);
      } catch {}
    };
    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleStopMic = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      setInterimTranscript('');
    }
  };

  return (
    <div
      className={`relative flex-1 flex items-center ${
        isListening ? 'ring-2 ring-blue-400 bg-blue-50' : ''
      }`}
    >
      <input
        type="text"
        value={isListening && interimTranscript ? interimTranscript : value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={isListening ? 'Listening...' : 'Ask a question...'}
        className={`w-full rounded border px-3 py-2 pr-10 ${isListening ? 'bg-blue-50' : ''}`}
        disabled={disabled || isListening}
      />
      {!isListening ? (
        <button
          type="button"
          onClick={handleMic}
          aria-label="Speak question"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-600"
          disabled={disabled}
          title="Speak question"
        >
          <MicIcon />
        </button>
      ) : (
        <button
          type="button"
          onClick={handleStopMic}
          aria-label="Stop listening"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-red-600 animate-pulse"
          title="Stop listening"
        >
          <StopIcon />
        </button>
      )}
      {/* Toast: shows brief messages about speech availability/errors */}
      {/* Note: toasts are handled by the global ToastHost component */}
    </div>
  );
}
