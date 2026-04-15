'use client';

/**
 * PlanSelector -- step 1 of upgrade flow.
 *
 * Three plan rows: Monthly / Quarterly (featured) / Annual.
 * Featured plan (Quarterly) gets border-2 border-[#534AB7] + "Most popular" badge.
 * Selected plan highlighted; state lifted to parent via onSelect.
 */

import React, { useMemo } from 'react';
import { PLANS } from '@/lib/billing/plans';
import type { PlanId, SubscriptionPlan } from '@/lib/billing/plans';

interface PlanSelectorProps {
  selected: PlanId;
  onSelect: (id: PlanId) => void;
}

// By default show all non-internal plans. Order: featured first, then by billed price.

function PlanRow({
  plan,
  isSelected,
  onSelect,
}: {
  plan: SubscriptionPlan;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const isFeatured = plan.featured ?? false;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'w-full text-left rounded-xl px-4 py-4 min-h-[56px] flex items-center gap-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#534AB7]',
        isFeatured
          ? 'border-2 border-[#534AB7]'
          : 'border border-gray-200 dark:border-slate-700',
        isSelected
          ? 'bg-[#EEEDFE] dark:bg-[#534AB7]/20'
          : 'bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700',
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

      {/* Plan details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {plan.label}
          </span>
          {isFeatured && (
            <span className="inline-flex items-center rounded-full bg-[#534AB7] px-2 py-0.5 text-[10px] font-bold text-white leading-none">
              Most popular
            </span>
          )}
          {plan.saveLabel && (
            <span className="inline-flex items-center rounded-full bg-[#EAF3DE] px-2 py-0.5 text-[10px] font-bold text-[#1D9E75] leading-none">
              {plan.saveLabel}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {plan.billedDisplay
            ? `${plan.perMonthDisplay} · ${plan.billedDisplay}`
            : `₹${plan.baseRupees} + GST ₹${plan.gstRupees.toFixed(2)}`}
        </p>
      </div>

      {/* Per-month price on right */}
      <span className="flex-shrink-0 text-sm font-bold text-gray-900 dark:text-gray-100">
        {plan.perMonthDisplay}
      </span>
    </button>
  );
}

export function PlanSelector({ selected, onSelect }: PlanSelectorProps) {
  const plans = useMemo(() => {
    try {
      const arr = Object.values(PLANS).filter((p) => !p.internal) as SubscriptionPlan[];
      arr.sort((a, b) => {
        const fa = a.featured ? 1 : 0;
        const fb = b.featured ? 1 : 0;
        if (fa !== fb) return fb - fa; // featured plans first
        return a.billedRupees - b.billedRupees; // then by price ascending
      });
      return arr;
    } catch {
      return [] as SubscriptionPlan[];
    }
  }, []);

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
        Choose your plan
      </h2>
      <div className="space-y-2">
        {plans.map((plan) => (
          <PlanRow
            key={plan.id}
            plan={plan}
            isSelected={selected === plan.id}
            onSelect={() => onSelect(plan.id)}
          />
        ))}
      </div>
    </div>
  );
}

export default PlanSelector;
