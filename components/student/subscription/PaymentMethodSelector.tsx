'use client';

/**
 * PaymentMethodSelector -- step 2 of upgrade flow.
 *
 * UPI is listed first (India-first default).
 * Each row is a radio-style button with min-height 44px.
 */

import React from 'react';

export type PaymentMethod = 'upi' | 'card' | 'netbanking';

interface PaymentMethodOption {
  id: PaymentMethod;
  label: string;
  subtitle: string;
  icon: string;
}

const METHODS: PaymentMethodOption[] = [
  {
    id: 'upi',
    label: 'UPI',
    subtitle: 'GPay · PhonePe · Paytm',
    icon: '📱',
  },
  {
    id: 'card',
    label: 'Debit / Credit Card',
    subtitle: 'Visa, Mastercard, RuPay',
    icon: '💳',
  },
  {
    id: 'netbanking',
    label: 'Net Banking',
    subtitle: 'All major Indian banks',
    icon: '🏦',
  },
];

interface PaymentMethodSelectorProps {
  selected: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
}

export function PaymentMethodSelector({ selected, onSelect }: PaymentMethodSelectorProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
        Payment method
      </h2>
      <div className="space-y-2">
        {METHODS.map((m) => {
          const isSelected = selected === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelect(m.id)}
              aria-pressed={isSelected ? 'true' : 'false'}
              className={[
                'w-full text-left rounded-xl border px-4 py-3 min-h-[44px] flex items-center gap-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#534AB7]',
                isSelected
                  ? 'border-[#534AB7] bg-[#EEEDFE] dark:bg-[#534AB7]/20 dark:border-[#534AB7]'
                  : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700',
              ].join(' ')}
            >
              {/* Radio indicator */}
              <span
                className={[
                  'flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center',
                  isSelected
                    ? 'border-[#534AB7] bg-[#534AB7]'
                    : 'border-gray-300 dark:border-slate-500',
                ].join(' ')}
                aria-hidden
              >
                {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
              </span>

              {/* Icon */}
              <span className="text-xl" aria-hidden>{m.icon}</span>

              {/* Label */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{m.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{m.subtitle}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default PaymentMethodSelector;
