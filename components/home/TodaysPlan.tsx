"use client";

import React, { useState } from 'react';

export type PlanSlot = {
  slotId: string | number;
  timeWindow?: string | null;
  topicTitle: string;
  duration?: number | string;
  status?: 'pending' | 'completed' | string;
};

export interface TodaysPlanProps {
  slots: PlanSlot[];
}

export default function TodaysPlan({ slots }: TodaysPlanProps) {
  const [collapsed, setCollapsed] = useState(true);

  const count = Array.isArray(slots) ? slots.length : 0;

  return (
    <section className="max-w-4xl mx-auto bg-white rounded-lg border p-6 mb-8" aria-labelledby="todays-plan-heading">
      <div className="flex items-center justify-between">
        <h3 id="todays-plan-heading" className="text-lg font-semibold">
          Today's Plan
        </h3>

        <div className="md:hidden">
          <button
            type="button"
            className="text-sm text-indigo-600 hover:underline"
            onClick={() => setCollapsed((s) => !s)}
            aria-expanded={!collapsed}
            aria-controls="todays-plan-list"
          >
            {collapsed ? `View ${count} items` : 'Hide'}
          </button>
        </div>
      </div>

      <ul
        id="todays-plan-list"
        role="list"
        className={`mt-3 space-y-2 ${collapsed ? 'hidden md:block' : 'block'}`}
      >
        {slots && slots.length > 0 ? (
          slots.map((s) => (
            <li
              key={s.slotId}
              className="flex items-center justify-between gap-3 py-2 border-b last:border-b-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                {s.timeWindow ? (
                  <div className="text-xs text-gray-500 w-24">{s.timeWindow}</div>
                ) : (
                  <div className="text-xs text-gray-400 w-24">&nbsp;</div>
                )}

                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{s.topicTitle}</div>
                  <div className="text-xs text-gray-500">{s.duration ?? '—'} min</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="text-sm bg-indigo-700 text-white px-3 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  aria-label={`Start ${s.topicTitle}`}
                >
                  Start
                </button>
              </div>
            </li>
          ))
        ) : (
          <li className="text-sm text-gray-500">No items scheduled for today</li>
        )}
      </ul>
    </section>
  );
}
