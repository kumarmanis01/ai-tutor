/**
 * FILE OBJECTIVE:
 * - LP-8.1 Schools banner: promotes institutional partnerships, benefits for schools,
 *   and CTA to contact the schools team.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/SchoolsBanner.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T00:00:00Z | copilot | created for v3 landing page
 */

// Server component -- no browser APIs or state

const SCHOOL_BENEFITS = [
  { emoji: '📊', label: 'Class-level analytics' },
  { emoji: '🎯', label: 'Curriculum-aligned content' },
  { emoji: '👩‍🏫', label: 'Teacher progress view' },
  { emoji: '💳', label: 'Bulk seat pricing' },
];

const SchoolsBanner = () => {
  return (
    <section id="schools" className="py-10 md:py-12 bg-secondary text-white">
      <div className="mx-auto px-4 md:px-6 lg:px-8 max-w-7xl">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest opacity-70 mb-2">
              For Schools &amp; Coaching Centres
            </p>
            <h2 className="font-headline font-bold text-2xl md:text-3xl mb-3">
              Spinzy for Schools
            </h2>
            <p className="font-body text-base opacity-90 mb-6 max-w-md">
              Give every student in your class access to AI-powered, syllabus-aligned practice.
              School administrators and teachers get a separate dashboard to track progress and
              assign work.
            </p>
            <a
              href="mailto:schools@spinzyacademy.com"
              className="inline-flex items-center gap-2 px-6 py-3 min-h-[48px] bg-white text-secondary font-semibold rounded-lg hover:bg-white/90 transition-all text-base"
            >
              Contact our schools team &rarr;
            </a>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {SCHOOL_BENEFITS.map((benefit) => (
              <div
                key={benefit.label}
                className="flex items-center gap-3 bg-white/10 rounded-xl p-4"
              >
                <span className="text-2xl" role="img" aria-hidden="true">
                  {benefit.emoji}
                </span>
                <span className="font-body text-sm font-semibold">{benefit.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default SchoolsBanner;
