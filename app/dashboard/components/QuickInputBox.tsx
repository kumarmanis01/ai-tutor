'use client';

/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import LanguageSelector from '@/components/LanguageSelector';
import { startVoiceInput, uploadImage } from '@/lib/inputHandlers';
import { toast } from '@/lib/toast';
import { logger } from '@/lib/logger';
import resizeImageFile from '@/lib/resizeImage';
import { Speech } from '@/lib/speech';

interface QuickInputBoxProps {
  onReply?: (reply: string, userMessage?: string, language?: string, suggestions?: string[]) => void;
  onError?: (err: string) => void;
  initialPreferredLang?: string | null;
  subject?: string;
  conversationId?: string | undefined;
  onConversationId?: (cid?: string) => void;
}

const QuickInputBox: React.FC<QuickInputBoxProps> = ({ onReply, onError, initialPreferredLang = null, subject, conversationId: conversationIdProp, onConversationId }) => {
  const [questionText, setQuestionText] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [interimTranscript, setInterimTranscript] = useState('');
    const stopVoiceRef = useRef<(() => void) | null>(null);
    // Start with a deterministic server-safe value to avoid hydration mismatches.
    // We'll load the user's saved preference (localStorage) or server value on mount.
    const [preferredLang, setPreferredLang] = useState<string>('auto');

    // On client mount, prefer in-order: `initialPreferredLang` prop -> localStorage -> server
    useEffect(() => {
      let cancelled = false;
      try {
        if (initialPreferredLang) {
          setPreferredLang(initialPreferredLang);
          try {
            localStorage.setItem('ai-tutor:preferredLang', initialPreferredLang);
          } catch {}
          return;
        }

        // Check localStorage first (fast, client-only)
        try {
          if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('ai-tutor:preferredLang');
            if (stored) {
              setPreferredLang(stored);
              return;
            }
          }
        } catch {}

        // Fall back to server-provided persisted language
        async function loadFromServer() {
          try {
            const res = await fetch('/api/user/language');
            if (!res.ok) return;
            const j = await res.json().catch(() => ({}));
            const serverLang = j?.language;
            if (!cancelled && serverLang && typeof serverLang === 'string') {
              setPreferredLang(serverLang);
              try {
                localStorage.setItem('ai-tutor:preferredLang', serverLang);
              } catch {}
            }
          } catch {}
        }
        loadFromServer();
      } catch {}
      return () => {
        cancelled = true;
      };
    }, [initialPreferredLang]);
    // Separate menu state so the Speak button menu and the Text-input menu do not conflict
    const [showLangMenuVoice, setShowLangMenuVoice] = useState(false);
    const [showLangMenuText, setShowLangMenuText] = useState(false);
    const [detectionPrompt, setDetectionPrompt] = useState<null | { lang: string; label: string }>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [images, setImages] = useState<{ id: string; url: string; uploading: boolean }[]>([]);

    const [favorites, setFavorites] = useState<string[]>([]);

    useEffect(() => {
      try {
        const raw = localStorage.getItem('ai-tutor:langFavorites');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setFavorites(parsed);
        }
      } catch {}
    }, []);

    const toggleFavorite = (tag: string) => {
      try {
        setFavorites((prev) => {
          let next: string[];
          if (prev.includes(tag)) {
            next = prev.filter((t) => t !== tag);
          } else {
            next = [tag, ...prev.filter((t) => t !== tag)].slice(0, 2);
          }
          try {
            localStorage.setItem('ai-tutor:langFavorites', JSON.stringify(next));
          } catch {}
          return next;
        });
      } catch {}
    };

    const handleSelectorPick = (name: string) => {
      try {
        const tag = mapNameToTag(name);
        setPreferredLang(tag);
        try {
          localStorage.setItem('ai-tutor:preferredLang', tag);
        } catch {}
        try {
          fetch('/api/user/language', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: tag }) }).catch(() => {});
        } catch {}
      } catch {}
      setShowLangMenuText(false);
    };

    const favSelected = favorites.includes(preferredLang);

  const handlePhotoUpload = () => {
    // Open file picker
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Create a local preview thumbnail and add to list as uploading
    // Create a small preview using the resize helper for better thumbnails
    let previewFile: File | Blob = file;
    try {
      previewFile = await resizeImageFile(file, { maxWidth: 800, maxHeight: 800, quality: 0.75, mimeType: 'image/jpeg' });
    } catch {
      previewFile = file;
    }
    const objectUrl = URL.createObjectURL(previewFile);
    const id = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 9);
    // Add a temporary object URL for immediate preview; we will replace with a data URL
    setImages((prev) => [...prev, { id, url: objectUrl, uploading: true }]);

    // Also read the file as data URL so we can use Next/Image without the lint warning
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || objectUrl);
      setImages((prev) => prev.map((it) => (it.id === id ? { ...it, url: dataUrl, uploading: it.uploading } : it)));
    };
    reader.onerror = () => {
      // keep objectUrl if reading fails
    };
    reader.readAsDataURL(file);

    try {
      const result = await uploadImage(file);
      if (!result.ok) {
        logger.error('upload failed', { className: 'QuickInputBox', methodName: 'handleFileChange', error: result.error, details: result.details });
        onError?.(result.error || 'Upload failed');
        // If the server returned an AWS credential-related error, surface a user-friendly toast
        try {
          const details = result.details || '';
          if (result.error === 'aws_credentials' || (typeof details === 'string' && details.toLowerCase().includes('credential'))) {
            setAwsCredentialError(details || 'AWS credentials invalid or expired. Run `aws sso login` or set `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` in your environment.');
            setAwsCredentialVisible(true);
          }
        } catch {}
        // mark as not uploading but keep preview so user can retry/remove
        setImages((prev) => prev.map((it) => (it.id === id ? { ...it, uploading: false } : it)));
        return;
      }

      // Replace the object URL with the uploaded URL
      setImages((prev) => prev.map((it) => (it.id === id ? { ...it, url: result.url, uploading: false } : it)));
      // Set a helpful prompt if the input was empty
      setQuestionText((prev) => prev || 'Describe the problem in the image...');
      logger.add(`Uploaded image URL: ${result.url}`, { className: 'QuickInputBox', methodName: 'handleFileChange' });
    } catch (err) {
      logger.error('Image upload error', { className: 'QuickInputBox', methodName: 'handleFileChange', error: String(err) });
      onError?.('Image upload failed');
      setImages((prev) => prev.map((it) => (it.id === id ? { ...it, uploading: false } : it)));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  

  // Emit a typing event so the chat container can dismiss suggestions when user types
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuestionText(e.target.value);
    try {
      // clear hint when user starts typing
      setSuggestionHint(null);
      if (hintTimeoutRef.current) {
        try {
          window.clearTimeout(hintTimeoutRef.current);
        } catch {}
        hintTimeoutRef.current = null;
      }
      window.dispatchEvent(new CustomEvent('chatUserTyped'));
    } catch {}
  };

  const [suggestionHint, setSuggestionHint] = useState<string | null>(null);
  const hintTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      // Revoke any remaining blob object URLs
      images.forEach((it) => {
        try {
          if (it.url && it.url.startsWith('blob:')) URL.revokeObjectURL(it.url);
        } catch {
          // ignore
        }
      });
    };
  }, [images]);

  // (language loading handled in the mount effect above)

  const handleVoiceInput = () => {
      // Start voice input via shared handler
      if (isListening) {
        // stop
        stopVoiceRef.current?.();
        stopVoiceRef.current = null;
        setIsListening(false);
        setInterimTranscript('');
        return;
      }

      // prefer browser locale when starting recognition so Hindi is recognized in Devanagari
      const navLang = typeof navigator !== 'undefined' ? navigator.language || 'en-US' : 'en-US';
      const resolvedNav = navLang.startsWith('hi') ? 'hi-IN' : navLang;
      const langToUse = preferredLang && preferredLang !== 'auto' ? preferredLang : resolvedNav;

      const stop = startVoiceInput(
        // interim
        (txt: string) => {
          setInterimTranscript(txt);
        },
        // final
        async (txt: string, detectedLang?: string) => {
          let finalText = txt;
          try {
            // If recognition suggests Hindi but result is romanized (Latin chars), try to transliterate to Devanagari
            const looksLatin = /^[A-Za-z0-9\s,.'"()-]+$/.test(String(txt).trim());
            if (detectedLang && String(detectedLang).toLowerCase().startsWith('hi') && looksLatin) {
              try {
                // Dynamic import so the package is optional. Recommend installing `sanscript` for better transliteration.
                const sanscript = await import('sanscript');
                if (sanscript && typeof sanscript.t === 'function') {
                  // Try common roman schemes -> devanagari
                  // Use 'iast' -> 'devanagari' as a best-effort, fall back to itrans if available
                  try {
                    finalText = sanscript.t(txt, 'iast', 'devanagari');
                  } catch {
                    try {
                      finalText = sanscript.t(txt, 'itrans', 'devanagari');
                    } catch {
                      // leave finalText as-is
                    }
                  }
                }
              } catch {
                // package not installed or failed; ignore and keep latin text
              }
            }
          } catch {
            // ignore
          }

          setQuestionText(finalText);
          if (detectedLang) {
            setDetectedLang(detectedLang);
            // persist preferred language locally and server-side
            try {
              try {
                localStorage.setItem('ai-tutor:preferredLang', detectedLang);
              } catch {}
              fetch('/api/user/language', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: detectedLang }) }).catch(() => {});
            } catch {}
          }
          setInterimTranscript('');
          setIsListening(false);
          stopVoiceRef.current = null;
        },
        // error
        (msg: string) => {
          onError?.(msg);
          try { toast(msg); } catch {}
          setIsListening(false);
          setInterimTranscript('');
          stopVoiceRef.current = null;
        },
        langToUse,
      );

      if (stop) {
        stopVoiceRef.current = stop;
        setIsListening(true);
      } else {
        // startVoiceInput may return null when recognition isn't supported or permission denied
        try {
          toast('Voice input not available in this browser or microphone not accessible.');
        } catch {}
      }
  };

  // Toggle small language menu (used by speak button)
  const toggleLangMenuVoice = () => setShowLangMenuVoice((s) => !s);

  const languageOptions = useMemo<{ value: string; label: string }[]>(() => ([
    { value: 'auto', label: 'Auto (browser)' },
    { value: 'hi-IN', label: 'हिन्दी (Hindi)' },
    { value: 'en-US', label: 'English' },
    { value: 'ta-IN', label: 'தமிழ் (Tamil)' },
    { value: 'bn-IN', label: 'বাংলা (Bengali)' },
    { value: 'fr-FR', label: 'Français' },
    { value: 'es-ES', label: 'Español' },
  ]), []);

  const languageOptionsRef = useRef(languageOptions);
  useEffect(() => { languageOptionsRef.current = languageOptions; }, [languageOptions]);
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const [asking, setAsking] = useState(false);
  const [detectedLang, setDetectedLang] = useState<string | undefined>(undefined);
  const [consentToShare, setConsentToShare] = useState(false);
  // Track conversation/topic id for threading context per chat panel
  const [conversationId, setConversationId] = useState<string | null>(conversationIdProp ?? null);
  useEffect(() => { setConversationId(conversationIdProp ?? null); }, [conversationIdProp]);

  const renderThumb = (it: { id: string; url: string; uploading: boolean }) => {
    const isBlob = !!(it.url && (it.url.startsWith('blob:') || it.url.startsWith('data:')));
    let disableOpt: boolean = isBlob;
    try {
      if (!disableOpt && it.url && (it.url.startsWith('http://') || it.url.startsWith('https://'))) {
        const u = new URL(it.url);
        if (u.hostname === 'ai-tutor-uploads-spinzyacademy-01.s3.eu-north-1.amazonaws.com') disableOpt = true;
      }
    } catch {
      // ignore malformed URLs
    }

    return (
      <div key={it.id} className="relative w-24 h-24 rounded-md overflow-hidden border border-border bg-muted flex-shrink-0">
        <Image
          src={it.url}
          alt="thumb"
          width={96}
          height={96}
          className="w-full h-full object-cover"
          unoptimized={disableOpt}
        />
        {it.uploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-xs text-white">Uploading</div>
        )}
        {!it.uploading && it.url && (it.url.startsWith('http://') || it.url.startsWith('https://')) && (
          <div className="absolute bottom-1 right-1 bg-emerald-600 text-white text-[10px] px-1.5 py-0.5 rounded">Ready</div>
        )}
        <button
          type="button"
          onClick={() => {
            try {
              if (it.url && it.url.startsWith('blob:')) URL.revokeObjectURL(it.url);
            } catch {
              // ignore
            }
            setImages((prev) => prev.filter((x) => x.id !== it.id));
          }}
          className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 text-xs flex items-center justify-center shadow-md"
          aria-label="Remove image"
        >
          ×
        </button>
      </div>
    );
  };
  // Send a message to the server-side chat API and return the AI reply and optional suggestions.
  const handleSend = useCallback(async (message: string, languageHint?: string): Promise<{ ok: boolean; reply?: string; error?: string; language?: string; suggestions?: string[] }> => {
    try {
      const imageUrls = images
        .filter((it) => it.url && (it.url.startsWith('http://') || it.url.startsWith('https://')) && !it.uploading)
        .map((it) => it.url);

      // Ensure a conversationId is present on first message so the server
      // can thread messages consistently even if it chooses not to generate one.
      let cidToSend = conversationId;
      if (!cidToSend) {
        cidToSend = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        try { setConversationId(cidToSend); } catch {}
      }

      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message, language: languageHint, images: imageUrls, consentToShare, conversationId: cidToSend, subject }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        return { ok: false, error: payload?.error || `status-${res.status}` };
      }
      const json = await res.json().catch(() => ({}));
      try {
        const cid = json?.conversationId || json?.topic;
        if (cid && typeof cid === 'string') { setConversationId(cid); try { onConversationId?.(cid); } catch {} }
      } catch {}
      // Normalize reply: if server mistakenly returned a JSON string, extract answer/suggestions
      let reply: string | undefined = json?.answer ?? json?.reply;
      let suggestions: string[] | undefined = Array.isArray(json?.suggestions) ? json.suggestions : undefined;
      let language: string | undefined = json?.language ?? json?.lang;
      try {
        if (typeof reply === 'string' && reply.trim().startsWith('{')) {
          const parsed = JSON.parse(reply);
          if (parsed && typeof parsed === 'object') {
            reply = parsed.answer || parsed.answerMarkdown || parsed.text || reply;
            if (!language) language = parsed.language || parsed.lang;
            if (!suggestions && Array.isArray(parsed.suggestions)) {
              suggestions = parsed.suggestions.filter((s: any) => typeof s === 'string').slice(0, 5);
            }
          }
        }
      } catch {}
      return { ok: true, reply, language, suggestions };
    } catch (err: any) {
      return { ok: false, error: err?.message || String(err) };
    }
  }, [images, consentToShare, conversationId, languageOptions, onError, subject]);

  const handleAskQuestion = useCallback(async () => {
    if (!questionText.trim() || asking) return;
    // Guard: if user attached images but none are ready (still uploading or blob/data), delay ask
    const hasAttached = images.length > 0;
    const readyRemote = images.filter((it) => it.url && (it.url.startsWith('http://') || it.url.startsWith('https://')) && !it.uploading);
    if (hasAttached && readyRemote.length === 0) {
      try {
        toast('Image is still uploading. Please wait a moment, then try Ask again.');
      } catch {}
      return;
    }
    try {
      setAsking(true);
      // Clear any suggestion hint once we submit
      try { setSuggestionHint(null); } catch {}
      const languageToSend = detectedLang ?? (preferredLang && preferredLang !== 'auto' ? preferredLang : undefined);
      const res = await handleSend(questionText.trim(), languageToSend);
      if (!res.ok) {
        logger.error('Question send failed', { className: 'QuickInputBox', methodName: 'handleAskQuestion', error: res.error });
        onErrorRef.current?.(res.error || 'Failed to ask question');
        return;
      }
      // Send AI reply to parent for display
      logger.add(`AI reply: ${String(res.reply)}`, { className: 'QuickInputBox', methodName: 'handleAsk' });
      // update detected language from response if provided
      if (res.language) {
        setDetectedLang(res.language);
        try {
          try {
            localStorage.setItem('ai-tutor:preferredLang', res.language);
          } catch {}
          fetch('/api/user/language', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: res.language }) }).catch(() => {});
        } catch {}
        // If server detected a language different from user's preference, prompt to switch
        try {
          const normPreferred = (preferredLang || 'auto').toLowerCase();
          const normDetected = String(res.language).toLowerCase();
          if (normDetected && normPreferred !== normDetected) {
            // find a label for the detected language
            const match = languageOptionsRef.current.find((o) => o.value.toLowerCase() === normDetected || o.value.toLowerCase().startsWith(normDetected.split('-')[0]));
            setDetectionPrompt({ lang: res.language, label: match ? match.label : res.language });
          }
        } catch {}
      }
      if (res.reply) {
        onReply?.(res.reply, questionText.trim(), res.language, res.suggestions);
        // Auto-speak using detected language from response or recognition
        try {
          const langToUse = (res as any).language || detectedLang || 'en-US';
          Speech.speak(res.reply, { lang: langToUse });
        } catch {
          // ignore TTS failures
        }
      }
      // Clear input after successful ask
      setQuestionText('');
      setInterimTranscript('');
      try { setSuggestionHint(null); } catch {}
    } finally {
      setAsking(false);
    }
  }, [questionText, asking, images, detectedLang, preferredLang, handleSend, onReply, setSuggestionHint, setDetectedLang, setAsking]);

  // Listen for picked suggestions to populate the input and auto-submit
  useEffect(() => {
    function onSuggestionPicked(e: Event) {
      try {
        const detail = (e as CustomEvent).detail as { suggestion: string } | undefined;
        if (!detail) return;
        const { suggestion } = detail;
        setQuestionText(suggestion);
        const hasAttached = images.length > 0;
        const readyRemote = images.filter((it) => it.url && (it.url.startsWith('http://') || it.url.startsWith('https://')) && !it.uploading);
        if (hasAttached && readyRemote.length === 0) {
          try { toast('Image is still uploading. Please wait a moment.'); } catch {}
          try { document.getElementById('question-input')?.focus(); } catch {}
          return;
        }
        setTimeout(() => {
          handleAskQuestion();
        }, 0);
      } catch (err) {
        logger.error('QuickInputBox suggestion handler error', { className: 'QuickInputBox', methodName: 'suggestionHandler', error: String(err) });
      }
    }
    window.addEventListener('chatSuggestionPicked', onSuggestionPicked as EventListener);
    return () => window.removeEventListener('chatSuggestionPicked', onSuggestionPicked as EventListener);
  }, [images, handleAskQuestion]);

  const acceptDetection = () => {
    if (!detectionPrompt) return;
    const v = detectionPrompt.lang;
    setPreferredLang(v);
    try {
      localStorage.setItem('ai-tutor:preferredLang', v);
    } catch {}
    try {
      fetch('/api/user/language', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: v }) }).catch(() => {});
    } catch {}
    setDetectionPrompt(null);
  };

  const dismissDetection = () => setDetectionPrompt(null);

  const [detectionFading, setDetectionFading] = useState(false);

  // AWS credential error toast state
  const [awsCredentialError, setAwsCredentialError] = useState<string | null>(null);
  const [awsCredentialVisible, setAwsCredentialVisible] = useState(false);

  // Auto-fade and dismiss detection toast: start fade at 7s, remove at 8s
  useEffect(() => {
    if (!detectionPrompt) {
      setDetectionFading(false);
      return;
    }
    setDetectionFading(false);
    const fadeTimer = window.setTimeout(() => setDetectionFading(true), 7000);
    const removeTimer = window.setTimeout(() => setDetectionPrompt(null), 8000);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
      setDetectionFading(false);
    };
  }, [detectionPrompt]);

  // Map tag-style preferredLang -> LanguageSelector 'lang' prop (names like 'Hindi')
  const mapTagToName = (tag: string) => {
    try {
      const t = String(tag || '').toLowerCase();
      if (t === 'auto') return 'auto';
      if (t.startsWith('hi')) return 'Hindi';
      if (t.startsWith('ta')) return 'Tamil';
      if (t.startsWith('bn')) return 'Bengali';
      if (t.startsWith('fr')) return 'French';
      if (t.startsWith('es')) return 'Spanish';
      if (t.startsWith('en')) return 'English';
    } catch {}
    return 'English';
  };

  const mapNameToTag = (name: string) => {
    try {
      const n = String(name || '').toLowerCase();
      if (n === 'auto') return 'auto';
      if (n.startsWith('hin') || n === 'hindi') return 'hi-IN';
      if (n.startsWith('tam') || n === 'tamil') return 'ta-IN';
      if (n.startsWith('ben') || n === 'bengali') return 'bn-IN';
      if (n.startsWith('fre') || n === 'french') return 'fr-FR';
      if (n.startsWith('spa') || n === 'spanish') return 'es-ES';
      if (n.startsWith('eng') || n === 'english') return 'en-US';
    } catch {}
    return 'en-US';
  };

  return (
    <div className="bg-card rounded-lg shadow-card p-4 border border-border">
      {/* Input Options */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {/* Photo Upload */}
        <button
          onClick={handlePhotoUpload}
          className="flex flex-col items-center justify-center p-4 bg-muted rounded-lg hover:bg-primary/10 transition-colors border border-border"
        >
          <svg className="w-8 h-8 text-primary mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-sm font-medium text-foreground">📸 Upload Photo</span>
          <span className="text-xs text-muted-foreground mt-1">फोटो लें</span>
        </button>

        {/* Voice Input with compact language toggle (menu) */}
        <div className="relative">
          <button
            onClick={handleVoiceInput}
            className="flex flex-col items-center justify-center p-4 bg-muted rounded-lg hover:bg-primary/10 transition-colors border border-border w-full"
            title="Speak (tap) — long-press or use the menu to change language"
          >
            <svg className="w-8 h-8 text-primary mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <span className="text-sm font-medium text-foreground">🎤 Speak</span>
            <span className="text-xs text-muted-foreground mt-1">बोलें</span>
          </button>

          {/* small menu toggle on the top-right of the Speak button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleLangMenuVoice();
            }}
            aria-label="Change language"
            className="absolute -top-1 -right-1 bg-card border border-border rounded-full p-1 shadow-sm"
            title="Choose language for voice recognition and replies"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 8l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {showLangMenuVoice && (
            <div className="absolute right-0 mt-2 z-50">
              <LanguageSelector
                lang={mapTagToName(preferredLang)}
                setLang={(name: string) => {
                  try {
                    const tag = mapNameToTag(name);
                    setPreferredLang(tag);
                    try {
                      localStorage.setItem('ai-tutor:preferredLang', tag);
                    } catch {}
                    try {
                      fetch('/api/user/language', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ language: tag }) }).catch(() => {});
                    } catch {}
                  } catch {}
                  setShowLangMenuVoice(false);
                }}
              />
            </div>
          )}
        </div>

        {/* Type Question */}
        <button
          onClick={() => document.getElementById('question-input')?.focus()}
          className="flex flex-col items-center justify-center p-4 bg-muted rounded-lg hover:bg-primary/10 transition-colors border border-border"
        >
          <svg className="w-8 h-8 text-primary mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span className="text-sm font-medium text-foreground">✍️ Type</span>
          <span className="text-xs text-muted-foreground mt-1">लिखें</span>
        </button>
      </div>

      {/* Text Input */}
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Language</div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowLangMenuText(true); }}
              className="px-3 py-1 rounded border border-border text-sm bg-card flex items-center gap-2"
              title="Select language"
            >
              <span>{mapTagToName(preferredLang)}</span>
              <svg className="w-3 h-3" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Favorite language"
              onClick={() => toggleFavorite(preferredLang)}
              className={`p-1 rounded ${favSelected ? 'text-yellow-400' : 'text-muted-foreground'}`}
              title={favSelected ? 'Unfavorite' : 'Add to favorites'}
            >
              ★
            </button>
          </div>
        </div>
      </div>
      {showLangMenuText && (
        <div className="absolute z-50">
          <LanguageSelector lang={mapTagToName(preferredLang)} setLang={(name: string) => { handleSelectorPick(name); setShowLangMenuText(false); }} />
        </div>
      )}
      <div className="mb-3">
        <input
          id="question-input"
          type="text"
          value={isListening && interimTranscript ? interimTranscript : questionText}
            onChange={handleInputChange}
          placeholder={isListening ? 'Listening... Speak now' : 'Type your question... / अपना सवाल लिखें...'}
          className="w-full px-4 py-3 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-base"
        />
        {asking && (
          <div className="mt-2 text-sm text-muted-foreground flex items-center gap-2" aria-live="polite" aria-busy="true" role="status">
            <span>Thinking</span>
            <span className="inline-flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/70 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/70 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/70 animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          </div>
        )}
      </div>

      {/* Suggestion hint (appears when a suggestion is inserted) */}
      {suggestionHint && (
        <div className="mb-3 text-sm text-muted-foreground">{suggestionHint}</div>
      )}

      {/* AWS credential remediation toast (persistent until dismissed) */}
      {awsCredentialVisible && awsCredentialError && (
        <div className="fixed right-4 bottom-4 z-50 w-auto max-w-sm bg-red-50 border border-red-200 rounded px-3 py-3 shadow-lg flex flex-col gap-2">
          <div className="text-sm text-red-900">Upload failed due to AWS credentials.</div>
          <div className="text-xs text-red-800 whitespace-pre-wrap">{awsCredentialError}</div>
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(awsCredentialError);
                } catch {
                  // ignore
                }
              }}
              className="px-2 py-1 text-xs rounded border border-border bg-card"
            >
              Copy steps
            </button>
            <button
              type="button"
              onClick={() => {
                setAwsCredentialVisible(false);
                setAwsCredentialError(null);
              }}
              className="px-2 py-1 text-xs rounded bg-red-600 text-white"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Detected language toast: transient, appears near bottom-right */}
      {detectionPrompt && (
        <div
          className={`fixed right-4 bottom-16 z-50 w-auto max-w-xs bg-card border border-border rounded px-3 py-2 shadow-lg flex items-center gap-3 transition-opacity duration-500 ${
            detectionFading ? 'opacity-0' : 'opacity-100'
          }`}
          role="status"
        >
          <div className="flex-1">
            <div className="text-sm">Detected <strong>{detectionPrompt.label}</strong>. Switch for future replies?</div>
            <div className="mt-2 h-1 w-full bg-muted rounded overflow-hidden">
              <div className="detection-toast-progress" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={dismissDetection} className="px-2 py-1 text-xs rounded border border-border">Keep</button>
            <button onClick={acceptDetection} className="px-2 py-1 text-xs rounded bg-primary text-primary-foreground">Switch</button>
          </div>
        </div>
      )}

      {/* Hidden file input for photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Thumbnails */}
      {images.length > 0 && (
        <div className="mb-3 flex gap-3 overflow-x-auto py-1">
          {images.map((it) => renderThumb(it))}
        </div>
      )}

      {/* Consent to share images with third-party provider for analysis */}
      {images.length > 0 && (
        <div className="mb-3 flex items-center gap-2 text-sm">
          <input
            id="consent-share"
            type="checkbox"
            checked={consentToShare}
            onChange={(e) => setConsentToShare(e.target.checked)}
            className="w-4 h-4"
          />
          <label htmlFor="consent-share" className="text-sm">
            I consent to upload this image to an external provider (OpenAI) for analysis. The image will be deleted within 24 hours. See our Privacy Policy.
          </label>
        </div>
      )}

      {/* Ask Button */}
        <button
          onClick={handleAskQuestion}
          className="w-full bg-primary hover:bg-accent text-primary-foreground font-semibold py-3 rounded-lg transition-colors shadow-cta"
          disabled={asking || (images.length > 0 && !consentToShare)}
      >
        {asking ? 'Asking…' : 'Ask AI Tutor / पूछें'}
      </button>
    </div>
  );
};

export default QuickInputBox;