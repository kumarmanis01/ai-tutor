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
  const period = billing === 'annual' ? '/yr' : '/mo';
  const accentClass =
    !selected && planKey === 'pro'
      ? 'border-blue-500 dark:border-blue-700 ring-1 ring-blue-50 dark:ring-blue-900'
      : '';
  // visual lift / z-index for Pro plan to make it stand out
  const proElevate = planKey === 'pro' ? 'relative -translate-y-2 scale-105 z-20' : '';

  // prepare CTA: if it's a valid React element, clone it and add highlight classes for Pro
  let ctaNode: React.ReactNode = null;
  if (cta) {
    if (React.isValidElement(cta)) {
      const element = cta as unknown as React.ReactElement<
        Record<string, unknown>,
        string | React.JSXElementConstructor<unknown>
      >;
      const existingClass = String((element.props as Record<string, unknown>)['className'] ?? '');
      const baseBorder = 'border border-gray-200 dark:border-gray-700';
      const proHighlight =
        planKey === 'pro'
          ? 'inline-flex items-center justify-center px-4 py-2 rounded-md bg-blue-600 text-white font-semibold shadow-lg hover:bg-blue-700 transition-colors z-20 relative'
          : 'inline-flex items-center justify-center px-4 py-2 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium shadow-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors';
      const updatedProps = {
        ...(element.props as Record<string, unknown>),
        className: `${existingClass} ${baseBorder} ${proHighlight}`.trim(),
      } as Partial<Record<string, unknown>> & React.Attributes;
      ctaNode = React.cloneElement(element, updatedProps);
    } else {
      ctaNode = cta;
    }
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      data-plan={planKey}
      aria-pressed={selected}
      className={`relative z-0 w-full text-left overflow-hidden rounded-2xl transition-all transform-gpu will-change-transform focus:outline-none focus:ring-2 focus:ring-blue-400
        ${
          selected
            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent shadow-2xl'
            : `bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100 shadow-md ${accentClass}`
        }
        ${compact ? 'p-3' : 'p-6'} ${proElevate} hover:shadow-xl`}
    >
      <div className={`flex items-center gap-3 ${compact ? 'text-sm' : ''}`}>
        <div className={`text-base font-semibold ${compact ? 'text-sm' : 'text-lg'}`}>{title}</div>
        {planKey === 'pro' && (
          <div className="inline-block px-2 py-0.5 text-lg font-medium rounded bg-yellow-400 text-black">
            Most subscribed
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          {!compact && features.length > 0 && (
            <div
              className={`mt-3 text-sm ${selected ? 'text-white/90' : 'text-gray-700 dark:text-gray-300'}`}
            >
              {features.slice(0, 4).map((f) => (
                <div key={f}>• {f}</div>
              ))}
            </div>
          )}
        </div>

        <div className="flex-none text-right">
          {hasPrices ? (
            <>
              <div
                className={`text-2xl font-extrabold ${selected ? 'text-white' : 'text-gray-900 dark:text-white'}`}
              >
                {displayPrice && displayPrice > 0 ? `₹${displayPrice}` : 'Free'}
              </div>
              <div className="text-sm mt-1 text-gray-600 dark:text-gray-400">
                {displayPrice && displayPrice > 0 ? `${period}` : ''}
              </div>
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

      {ctaNode && <div className="mt-6 flex items-center">{ctaNode}</div>}
    </button>
  );
}
