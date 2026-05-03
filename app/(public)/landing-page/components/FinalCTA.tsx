/**
 * FILE OBJECTIVE:
 * - LP-9.1 final conversion section with primary Google sign-in CTA and secondary team contact link.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/FinalCTA.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | initial FinalCTA with Teacher Vidya headline
 * - 2026-04-27T00:00:00Z | copilot | v3: student-focused bilingual headline, updated CTA link
 * - 2026-04-27T14:30:00Z | copilot | LP-9.1: update title/subtitle/button/link copy and gradient styling
 */
import Link from 'next/link';
import Icon from '@/components/UI/AppIcon';

const FinalCTA = () => {
  return (
    <section className="relative overflow-hidden py-12 md:py-16 bg-gradient-to-br from-[#EEEDFE] via-white to-[#FAEEDA]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#FF6B35]/15 blur-2xl"
      />
      <div className="mx-auto px-4 md:px-6 lg:px-8 max-w-4xl">
        <div className="text-center space-y-5 md:space-y-6 rounded-3xl border border-[#534AB7]/15 bg-white/80 backdrop-blur-sm px-5 py-8 md:px-10 md:py-10 shadow-lg">
          <p className="text-4xl" aria-hidden="true">
            📚
          </p>

          <h2 className="font-headline font-bold text-3xl md:text-4xl lg:text-5xl text-secondary">
            Ready to transform your child's learning?
          </h2>

          <p className="font-body text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Join 10,000+ Indian parents who&apos;ve switched to smarter tutoring.
          </p>

          <div className="flex flex-col items-center gap-4">
            <Link
              href="/auth/signin"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 md:px-10 md:py-5 min-h-[48px] w-full sm:w-auto bg-[#534AB7] text-white font-cta font-bold rounded-xl hover:bg-[#4338A0] transition-all text-base md:text-lg shadow-xl"
            >
              <Icon name="SparklesIcon" size={24} variant="solid" />
              Start Here
            </Link>

            <a
              href="mailto:hello@spinzyacademy.com"
              className="text-sm md:text-base font-semibold text-[#534AB7] hover:underline"
            >
              Talk to our team
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Icon name="CheckCircleIcon" size={16} variant="solid" />
              3 free sessions every month
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="CheckCircleIcon" size={16} variant="solid" />
              No credit card required
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
