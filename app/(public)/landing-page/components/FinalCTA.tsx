/**
 * FILE OBJECTIVE:
 * - LP-8.x Final CTA before footer: bilingual headline, primary register CTA, trust microcopy.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/FinalCTA.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | initial FinalCTA with Teacher Vidya headline
 * - 2026-04-27T00:00:00Z | copilot | v3: student-focused bilingual headline, updated CTA link
 */
import Link from 'next/link';
import Icon from '@/components/UI/AppIcon';
import { FREE_SESSIONS_TEXT } from '@/lib/constants/freeTier';

const FinalCTA = () => {
  return (
    <section className="py-12 md:py-16 bg-gradient-to-br from-primary via-accent to-secondary">
      <div className="mx-auto px-4 md:px-6 lg:px-8 max-w-3xl">
        <div className="text-center text-white space-y-6 md:space-y-8">
          <h2 className="font-headline font-bold text-3xl md:text-4xl lg:text-5xl">
            Ready to try it yourself?
          </h2>

          <p className="font-accent text-xl md:text-2xl">
            आज ही शुरू करें -- बिल्कुल मुफ्त
          </p>

          <p className="font-body text-lg md:text-xl opacity-90 max-w-2xl mx-auto">
            {FREE_SESSIONS_TEXT}. No credit card. 7-day refund policy.
          </p>

          <div className="flex justify-center">
            <Link
              href="https://app.spinzyacademy.com/register"
              className="inline-flex items-center gap-2 px-8 py-4 md:px-10 md:py-5 min-h-[44px] bg-white text-[#534AB7] font-cta font-bold rounded-lg hover:bg-white/90 transition-all text-lg md:text-xl shadow-xl"
            >
              <Icon name="SparklesIcon" size={24} variant="solid" />
              Get started -- it takes 2 minutes
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm opacity-90">
            <span className="flex items-center gap-1.5">
              <Icon name="CheckCircleIcon" size={16} variant="solid" />
              CBSE &amp; ICSE aligned
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="CheckCircleIcon" size={16} variant="solid" />
              Class 1-12
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="CheckCircleIcon" size={16} variant="solid" />
              Hindi &amp; English
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
