'use client';

import React, { useState, useRef } from 'react';
import { startVoiceInput } from '@/lib/inputHandlers';

interface QuickInputBoxProps { [key: string]: unknown }

const QuickInputBox: React.FC<QuickInputBoxProps> = () => {
  const [questionText, setQuestionText] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [interimTranscript, setInterimTranscript] = useState('');
    const stopVoiceRef = useRef<(() => void) | null>(null);

  const handlePhotoUpload = () => {
    // Handle photo upload
    console.log('Photo upload clicked');
  };

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
        (txt: string) => {
          setQuestionText(txt);
          setInterimTranscript('');
          setIsListening(false);
          stopVoiceRef.current = null;
        },
        // error
        (msg: string) => {
          alert(msg);
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

  const handleAskQuestion = () => {
    if (questionText.trim()) {
      console.log('Asking question:', questionText);
      // Process question
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

      {/* Ask Button */}
        <button
          onClick={handleAskQuestion}
          className="w-full bg-primary hover:bg-accent text-primary-foreground font-semibold py-3 rounded-lg transition-colors shadow-cta"
      >
        Ask AI Tutor / पूछें
      </button>
    </div>
  );
};

export default QuickInputBox;