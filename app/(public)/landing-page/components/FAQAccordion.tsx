/**
 * FILE OBJECTIVE:
 * - Reusable accordion renderer for landing FAQ content with smooth 300ms expand/collapse animation.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/FAQAccordion.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T14:30:00Z | copilot | created reusable FAQ accordion for LP-7.1 with all-collapsed default
 */
'use client';

import { useState } from 'react';
import Icon from '@/components/UI/AppIcon';
import type { FAQ } from './faq-data';

interface FAQAccordionProps {
  items: FAQ[];
}

const FAQAccordion = ({ items }: FAQAccordionProps) => {
  const [openId, setOpenId] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      {items.map((faq) => {
        const isOpen = openId === faq.id;

        return (
          <div
            key={faq.id}
            className="bg-background border-2 border-border rounded-xl overflow-hidden hover:border-primary/30 transition-colors"
          >
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : faq.id)}
              aria-expanded={isOpen ? 'true' : 'false'}
              className="w-full flex items-center justify-between p-6 text-left"
            >
              <div className="flex-1 pr-4">
                <h3 className="font-headline font-bold text-lg md:text-xl text-secondary mb-1">
                  {faq.questionEn}
                </h3>
                <p className="font-accent text-sm md:text-base text-primary">{faq.questionHi}</p>
              </div>
              <div
                className={`w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 transition-transform duration-300 ease-in-out ${
                  isOpen ? 'rotate-180' : ''
                }`}
              >
                <Icon
                  name="ChevronDownIcon"
                  size={20}
                  variant="outline"
                  className="text-primary"
                />
              </div>
            </button>

            <div
              className={`grid transition-all duration-300 ease-in-out ${
                isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden">
                <div className="px-6 pb-6 pt-1 space-y-3">
                  <div className="pt-3 border-t border-border">
                    <p className="font-body text-base text-foreground leading-relaxed mb-3">
                      {faq.answerEn}
                    </p>
                    <p className="font-accent text-base text-foreground/80 leading-relaxed">
                      {faq.answerHi}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FAQAccordion;