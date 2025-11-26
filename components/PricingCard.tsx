import React from 'react';

type Props = {
  planKey: string;
  title: string;
  priceMonthly?: number;
  priceAnnual?: number;
  features?: string[];
  selected?: boolean;
  compact?: boolean;
  onSelect?: () => void;
  cta?: React.ReactNode;
  billing?: 'monthly' | 'annual';
};

export default function PricingCard({
  planKey,
  title,
  priceMonthly,
  priceAnnual,
  features = [],
  selected = false,
  compact = false,
  onSelect,
  cta,
  billing = 'monthly',
}: Props) {
  const hasPrices = priceMonthly !== undefined || priceAnnual !== undefined;
  const displayPrice =
    billing === 'annual' ? (priceAnnual ?? priceMonthly) : (priceMonthly ?? priceAnnual);
  const period = billing === 'annual' ? 'per year' : 'per month';
  const accentClass =
    !selected && planKey === 'pro'
      ? 'border-blue-500 dark:border-blue-700 ring-1 ring-blue-50 dark:ring-blue-900'
      : '';

  return (
    <button
      type="button"
      onClick={onSelect}
      data-plan={planKey}
      aria-pressed={selected}
      className={`w-full text-left p-4 rounded-lg transition-shadow focus:outline-none focus:ring-2 focus:ring-blue-400
        ${
          selected
            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent shadow-lg'
            : `bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 shadow-sm ${accentClass}`
        }
        ${compact ? 'p-3' : 'p-6'}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className={`text-base font-semibold ${compact ? 'text-sm' : 'text-lg'}`}>
            {title}
          </div>
          {features.length > 0 && (
            <div
              className={`text-xs mt-1 ${selected ? 'text-white/90' : 'text-gray-700 dark:text-gray-300'}`}
            >
              {compact
                ? features.slice(0, 2).join(' • ')
                : features.map((f) => <div key={f}>{f}</div>)}
            </div>
          )}
        </div>

        <div className="text-right">
          {hasPrices ? (
            <>
              <div
                className={`font-bold ${selected ? 'text-white' : 'text-gray-900 dark:text-white'}`}
              >
                {displayPrice && displayPrice > 0 ? `₹${displayPrice}` : 'Free'}
              </div>
              <div className="text-sm text-gray-700 dark:text-gray-300">{period}</div>
            </>
          ) : (
            <div
              className={`font-bold ${selected ? 'text-white' : 'text-gray-900 dark:text-white'}`}
            >
              Custom
            </div>
          )}
        </div>
      </div>

      {!compact && features.length > 0 && (
        <ul className="mt-4 text-sm space-y-1 text-left text-gray-700 dark:text-gray-300">
          {features.map((f) => (
            <li key={f}>• {f}</li>
          ))}
        </ul>
      )}

      {cta && <div className="mt-4">{cta}</div>}
    </button>
  );
}
