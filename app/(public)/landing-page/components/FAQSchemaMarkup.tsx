/**
 * FILE OBJECTIVE:
 * - Emit FAQPage JSON-LD schema markup from server boundary for SEO reliability and XSS safety.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/faq-schema-markup.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-26T00:00:00Z | copilot | LP-7.1: server component for FAQPage JSON-LD, safe serialization, SEO crawler visibility
 */

import { safeJsonLd } from '@/lib/seo/safeJsonLd';
import { getFAQs } from './faq-data';

export async function FAQSchemaMarkup() {
  const faqs = getFAQs();

  const schemaData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.questionEn,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answerEn,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: safeJsonLd(schemaData),
      }}
    />
  );
}
