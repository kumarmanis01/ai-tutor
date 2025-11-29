'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { startVoiceInput, uploadImage } from '@/lib/inputHandlers';
import { Speech } from '@/lib/speech';

interface QuickInputBoxProps {
  onReply?: (reply: string, userMessage?: string) => void;
  onError?: (err: string) => void;
}

const QuickInputBox: React.FC<QuickInputBoxProps> = ({ onReply, onError }) => {
  const [questionText, setQuestionText] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [interimTranscript, setInterimTranscript] = useState('');
    const stopVoiceRef = useRef<(() => void) | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [images, setImages] = useState<{ id: string; url: string; uploading: boolean }[]>([]);

  const handlePhotoUpload = () => {
    // Open file picker
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Create a local preview thumbnail and add to list as uploading
    const objectUrl = URL.createObjectURL(file);
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
        console.error('upload failed', result.error);
        onError?.(result.error || 'Upload failed');
        // mark as not uploading but keep preview so user can retry/remove
        setImages((prev) => prev.map((it) => (it.id === id ? { ...it, uploading: false } : it)));
        return;
      }

      // Replace the object URL with the uploaded URL
      setImages((prev) => prev.map((it) => (it.id === id ? { ...it, url: result.url, uploading: false } : it)));
      // Set a helpful prompt if the input was empty
      setQuestionText((prev) => prev || 'Describe the problem in the image...');
      console.log('Uploaded image URL:', result.url);
    } catch (err) {
      console.error('Image upload error', err);
      onError?.('Image upload failed');
      setImages((prev) => prev.map((it) => (it.id === id ? { ...it, uploading: false } : it)));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

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

      const stop = startVoiceInput(
        // interim
        (txt: string) => {
          setInterimTranscript(txt);
        },
        // final
        (txt: string, detectedLang?: string) => {
          setQuestionText(txt);
          if (detectedLang) setDetectedLang(detectedLang);
          setInterimTranscript('');
          setIsListening(false);
          stopVoiceRef.current = null;
        },
        // error
        (msg: string) => {
          onError?.(msg);
          setIsListening(false);
          setInterimTranscript('');
          stopVoiceRef.current = null;
        },
      );

      if (stop) {
        stopVoiceRef.current = stop;
        setIsListening(true);
      }
  };

  const [asking, setAsking] = useState(false);
  const [detectedLang, setDetectedLang] = useState<string | undefined>(undefined);
  const [consentToShare, setConsentToShare] = useState(false);
  // Send a message to the server-side chat API and return the AI reply.
  async function handleSend(message: string, language?: string): Promise<{ ok: boolean; reply?: string; error?: string; language?: string }> {
    try {
      // Include uploaded image URLs (only remote/http URLs) so server can incorporate them
      const imageUrls = images
        .filter((it) => it.url && (it.url.startsWith('http://') || it.url.startsWith('https://')) && !it.uploading)
        .map((it) => it.url);

      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message, language, images: imageUrls, consentToShare }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        return { ok: false, error: payload?.error || `status-${res.status}` };
      }
      const json = await res.json().catch(() => ({}));
      // API returns { language, answer }
      return { ok: true, reply: json?.answer ?? json?.reply, language: json?.language ?? json?.lang };
    } catch (err: any) {
      return { ok: false, error: err?.message || String(err) };
    }
  }

  const handleAskQuestion = async () => {
    if (!questionText.trim() || asking) return;
    try {
      setAsking(true);
      const res = await handleSend(questionText.trim(), detectedLang);
      if (!res.ok) {
        console.error('Question send failed', res.error);
        onError?.(res.error || 'Failed to ask question');
        return;
      }
      // Send AI reply to parent for display
      console.log('AI reply:', res.reply);
      // update detected language from response if provided
      if (res.language) setDetectedLang(res.language);
      if (res.reply) {
        onReply?.(res.reply, questionText.trim());
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
    } finally {
      setAsking(false);
    }
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

        {/* Voice Input */}
        <button
          onClick={handleVoiceInput}
          className="flex flex-col items-center justify-center p-4 bg-muted rounded-lg hover:bg-primary/10 transition-colors border border-border"
        >
          <svg className="w-8 h-8 text-primary mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          <span className="text-sm font-medium text-foreground">🎤 Speak</span>
          <span className="text-xs text-muted-foreground mt-1">बोलें</span>
        </button>

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
      <div className="mb-3">
        <input
          id="question-input"
          type="text"
          value={isListening && interimTranscript ? interimTranscript : questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          placeholder={isListening ? 'Listening... Speak now' : 'Type your question... / अपना सवाल लिखें...'}
          className="w-full px-4 py-3 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-base"
        />
      </div>

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
          {images.map((it) => (
            <div key={it.id} className="relative w-24 h-24 rounded-md overflow-hidden border border-border bg-muted flex-shrink-0">
              <Image
                src={it.url}
                alt="thumb"
                width={96}
                height={96}
                className="w-full h-full object-cover"
                unoptimized={it.url.startsWith('blob:') || it.url.startsWith('data:')}
              />
              {it.uploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-xs text-white">Uploading</div>
              )}
              <button
                type="button"
                onClick={() => {
                  // revoke blob URL if needed
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
          ))}
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
          disabled={images.length > 0 && !consentToShare}
      >
        Ask AI Tutor / पूछें
      </button>
    </div>
  );
};

export default QuickInputBox;