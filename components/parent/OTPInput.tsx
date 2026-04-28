/**
 * FILE OBJECTIVE:
 * - P1.3-R: Accessible 6-digit OTP input component with per-digit boxes,
 *   auto-advance on digit entry, backspace navigation, and paste support.
 *   Calls onComplete when all 6 digits are entered.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/parent/OTPInput.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | staff-engineer | created per P1.3-R AC
 */

'use client';

import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';

interface OTPInputProps {
  length?: number;
  onComplete: (code: string) => void;
  disabled?: boolean;
  'aria-label'?: string;
}

export default function OTPInput({
  length = 6,
  onComplete,
  disabled = false,
  'aria-label': ariaLabel = 'One-time password',
}: OTPInputProps) {
  const [digits, setDigits] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  function updateDigit(index: number, value: string) {
    // Accept single digit or multi-digit (mobile autofill) and distribute
    const numeric = value.replace(/\D/g, '');
    if (!numeric) return;

    const next = [...digits];
    // If multiple digits provided, distribute starting at index
    if (numeric.length > 1) {
      for (let i = 0; i < numeric.length && index + i < length; i++) {
        next[index + i] = numeric[i];
      }
      setDigits(next);
      const focusIndex = Math.min(index + numeric.length, length - 1);
      inputRefs.current[focusIndex]?.focus();
    } else {
      next[index] = numeric;
      setDigits(next);
      if (index < length - 1) inputRefs.current[index + 1]?.focus();
    }

    if (next.every(Boolean)) onComplete(next.join(''));
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!text) return;
    const next = Array(length).fill('');
    for (let i = 0; i < text.length; i++) {
      next[i] = text[i];
    }
    setDigits(next);
    const lastIndex = Math.min(text.length, length - 1);
    inputRefs.current[lastIndex]?.focus();
    if (text.length === length) {
      onComplete(text);
    }
  }

  return (
    <div role="group" aria-label={ariaLabel} className="flex gap-3 justify-center">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            inputRefs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          pattern="\d"
          maxLength={1}
          value={digit}
          disabled={disabled}
          aria-label={`Digit ${i + 1} of ${length}`}
          onChange={(e) => updateDigit(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className="w-11 h-14 text-center text-xl font-bold border-2 rounded-xl
            border-gray-300 focus:border-[#534AB7] focus:outline-none focus:ring-2
            focus:ring-[#534AB7]/30 disabled:opacity-50 bg-white dark:bg-gray-800
            dark:border-gray-600 dark:text-white transition-colors"
        />
      ))}
    </div>
  );
}
