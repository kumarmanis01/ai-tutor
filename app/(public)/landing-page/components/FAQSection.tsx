/**
 * FILE OBJECTIVE:
 * - Render FAQ section (accordion UI) on the public landing page.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/faq-section.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-19T00:00:00Z | copilot | fix(lint): alias unused imports to _-prefixed vars
 * - 2026-04-26T00:00:00Z | copilot | LP-7.1: add FAQPage schema markup (JSON-LD) for SEO
 * - 2026-04-26T00:00:00Z | copilot | fix(security): remove JSON-LD from client component, move to server; extract FAQ data as constant
 * - 2026-04-26T11:20:00Z | copilot | remove unused PLANS import to keep lint clean
 */

'use client';

import { useState } from 'react';
import Icon from '@/components/UI/AppIcon';
import { getFAQs } from './faq-data';

const FAQSection = () => {
  const [openFAQ, setOpenFAQ] = useState<number | null>(1);

  const faqs = getFAQs();

  return (
    <section id="faq" className="py-12 md:py-16 bg-background">
      <div className="mx-auto px-4 md:px-6 lg:px-8 max-w-4xl">
        <div className="text-center mb-12 md:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary/10 text-secondary rounded-full text-sm font-medium mb-4">
            <Icon name="QuestionMarkCircleIcon" size={20} variant="solid" />
            <span>Common Questions</span>
          </div>
          <h2 className="font-headline font-bold text-3xl md:text-4xl lg:text-5xl text-secondary mb-4">
            Frequently Asked Questions
          </h2>
          <p className="font-accent text-xl md:text-2xl text-primary mb-2">
            अक्सर पूछे जाने वाले प्रश्न
          </p>
          <p className="font-body text-lg text-muted-foreground">
            Get answers to common parent concerns about Spinzy Academy
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq) => (
            <div
              key={faq.id}
              className="bg-background border-2 border-border rounded-xl overflow-hidden hover:border-primary/30 transition-colors"
            >
              <button
                onClick={() => setOpenFAQ(openFAQ === faq.id ? null : faq.id)}
                className="w-full flex items-center justify-between p-6 text-left"
              >
                <div className="flex-1 pr-4">
                  <h3 className="font-headline font-bold text-lg md:text-xl text-secondary mb-1">
                    {faq.questionEn}
                  </h3>
                  <p className="font-accent text-sm md:text-base text-primary">{faq.questionHi}</p>
                </div>
                <div
                  className={`w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 transition-transform duration-250 ${
                    openFAQ === faq.id ? 'rotate-180' : ''
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

              {openFAQ === faq.id && (
                <div className="px-6 pb-6 space-y-3">
                  <div className="pt-3 border-t border-border">
                    <p className="font-body text-base text-foreground leading-relaxed mb-3">
                      {faq.answerEn}
                    </p>
                    <p className="font-accent text-base text-foreground/80 leading-relaxed">
                      {faq.answerHi}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-12 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl p-6 md:p-8 border-2 border-border">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
              <Icon
                name="ChatBubbleLeftRightIcon"
                size={32}
                variant="solid"
                className="text-white"
              />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="font-headline font-bold text-xl md:text-2xl text-secondary mb-2">
                Still Have Questions?
              </h3>
              <p className="font-body text-base text-muted-foreground mb-4">
                Our support team is available 24×7 to help you. Call, WhatsApp, or email us anytime.
              </p>
              <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                <a
                  href="tel:+918920754675"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-accent transition-colors font-semibold"
                >
                  <Icon name="PhoneIcon" size={20} variant="solid" />
                  <span>+91 89207 54675</span>
                </a>
                <a
                  href="mailto:support@spinzyacademy.com"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-lg hover:bg-secondary/90 transition-colors font-semibold"
                >
                  <Icon name="EnvelopeIcon" size={20} variant="solid" />
                  <span>support@spinzyacademy.com</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
