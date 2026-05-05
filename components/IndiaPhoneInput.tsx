'use client';

import { type ChangeEvent } from 'react';

interface IndiaPhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/**
 * Phone input for Indian mobile numbers.
 * Shows a non-editable +91 dial code prefix.
 * Accepts exactly 10 digits (no leading 0).
 * Stores value as "91XXXXXXXXXX" (no +, no spaces).
 */
export default function IndiaPhoneInput({
  value,
  onChange,
  error,
  placeholder = '9876543210',
  disabled = false,
  id,
  className = '',
}: IndiaPhoneInputProps) {
  // Strip country prefix from stored value for display
  const displayValue = value.startsWith('91') ? value.slice(2) : value.startsWith('+91') ? value.slice(3) : value;

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 10);
    onChange(raw ? `91${raw}` : '');
  }

  const isValid = displayValue.length === 0 || (displayValue.length === 10 && !displayValue.startsWith('0'));

  return (
    <div className={`w-full ${className}`}>
      <div
        className={`flex items-center rounded-xl border bg-white dark:bg-gray-900 focus-within:ring-2 focus-within:ring-[#534AB7] focus-within:border-transparent transition-shadow ${
          error ? 'border-[#E24B4A]' : 'border-gray-300 dark:border-gray-600'
        }`}
      >
        <span
          className="px-3 py-3 text-sm font-medium text-gray-500 dark:text-gray-400 select-none border-r border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 rounded-l-xl whitespace-nowrap"
          aria-hidden="true"
        >
          +91
        </span>
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]{10}"
          maxLength={10}
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          aria-label="Mobile number (India +91)"
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className="flex-1 px-3 py-3 text-sm bg-transparent text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none rounded-r-xl disabled:opacity-50"
        />
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-[#E24B4A]">
          {error}
        </p>
      )}
      {!error && !isValid && displayValue.length > 0 && (
        <p className="mt-1 text-xs text-[#BA7517]">
          Enter a valid 10-digit mobile number
        </p>
      )}
    </div>
  );
}

/**
 * Validates a stored phone value (format: "91XXXXXXXXXX").
 * Returns true if the number is a valid 10-digit Indian mobile number.
 */
export function isValidIndiaPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) {
    const local = digits.slice(2);
    return local.length === 10 && !local.startsWith('0');
  }
  return digits.length === 10 && !digits.startsWith('0');
}
