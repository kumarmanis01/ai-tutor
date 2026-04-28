/**
 * FILE OBJECTIVE:
 * - LP-8.1 Schools banner: promotes institutional partnerships with correct AC copy,
 *   4-benefit grid (Teacher Dashboard, Bulk Onboarding, Auto-Consent, Curriculum-Aligned),
 *   and "Partner With Us" CTA that pre-fills the schools@spinzyacademy.com subject line.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/SchoolsBanner.spec.tsx
 *
 * EDIT LOG:
 * - 2026-04-27T00:00:00Z | copilot | created for v3 landing page
 * - 2026-04-28T00:00:00Z | staff-engineer | LP-8.1: restore Sprint-2 AC -- correct
 *   subheadline, 4 AC benefit cards, "Partner With Us" CTA with pre-filled subject
 */

const SCHOOL_BENEFITS = [
  {
    emoji: '📋',
    label: 'Teacher Dashboard',
    desc: 'Monitor class-wide progress and identify common weak topics.',
  },
  {
    emoji: '👥',
    label: 'Bulk Onboarding',
    desc: 'Add entire classes with one CSV upload.',
  },
  {
    emoji: '🛡️',
    label: 'Auto-Consent',
    desc: 'Parent consent emails sent automatically. DPDP-compliant.',
  },
  {
    emoji: '📚',
    label: 'Curriculum-Aligned',
    desc: 'CBSE, ICSE, and State Board ready.',
  },
];

const PARTNER_MAILTO =
  'mailto:schools@spinzyacademy.com?subject=School%20Partnership%20Enquiry%20%E2%80%94%20Spinzy%20Academy';

const SchoolsBanner = () => {
  return (
    <section id="schools" className="bg-secondary py-10 text-white md:py-12">
      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest opacity-70">
              For Schools &amp; Coaching Centres
            </p>
            <h2 className="mb-1 font-headline text-2xl font-bold md:text-3xl">
              Spinzy for Schools
            </h2>
            <p className="mb-4 font-accent text-base opacity-80">
              स्कूलों के लिए Spinzy
            </p>
            <p className="mb-6 max-w-md font-body text-base opacity-90">
              Give your students AI-powered supplementary learning -- with teacher dashboards
              and DPDP-compliant parent consent management.
            </p>
            <a
              href={PARTNER_MAILTO}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-semibold text-secondary transition-all hover:bg-white/90"
            >
              Partner With Us &rarr;
            </a>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {SCHOOL_BENEFITS.map((benefit) => (
              <div
                key={benefit.label}
                className="flex flex-col gap-2 rounded-xl bg-white/10 p-4"
              >
                <span className="text-2xl" role="img" aria-hidden="true">
                  {benefit.emoji}
                </span>
                <p className="font-body text-sm font-semibold">{benefit.label}</p>
                <p className="font-body text-xs opacity-80">{benefit.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default SchoolsBanner;
