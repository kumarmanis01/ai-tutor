/**
 * FILE OBJECTIVE:
 * - LP-5.1 testimonials section: two testimonial cards (Sunita Sharma + Priya Menon).
 *   Sunita card has a before/after progress bar (45% -> 78%).
 *   Priya card has a Safety Badge (DPDP Compliant shield).
 *   Section title: "Parents Trust Spinzy. Here's Why."
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/TestimonialsSection.spec.tsx
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | created v3 testimonials carousel
 * - 2026-04-28T00:00:00Z | staff-engineer | LP-5.1: restore Sprint-2 AC -- correct title,
 *   two-card layout, Priya Menon trust testimonial, safety badge, progress bar
 */

const TESTIMONIALS = [
  {
    id: 'sunita',
    name: 'Sunita Sharma',
    initial: 'S',
    avatarColor: 'bg-[#534AB7]',
    location: 'Jaipur, Rajasthan',
    role: 'Mother of Class 8 Student',
    rating: 5,
    quoteEn:
      "My daughter's marks improved from 45% to 78% in just 3 months! The Hindi explanations helped her understand concepts she struggled with for years. We saved ₹2500 monthly by canceling expensive tuition.",
    beforePct: 45,
    afterPct: 78,
    savingsLabel: '₹2,500/month saved',
    badge: null,
  },
  {
    id: 'priya',
    name: 'Priya Menon',
    initial: 'P',
    avatarColor: 'bg-[#1D9E75]',
    location: 'Mumbai',
    role: 'Mother of Class 6 Student',
    rating: 5,
    quoteEn:
      "I was scared of AI apps. But Spinzy asked MY permission before my son could use it. I set a 1-hour daily limit. Now I get a report every Sunday. Finally, an app I trust, not one I monitor nervously.",
    quoteHi:
      "मुझे AI apps से डर लगता था। लेकिन Spinzy ने मेरे बेटे के उपयोग से पहले मेरी अनुमति मांगी। मैंने 1 घंटे की दैनिक सीमा तय की। अब हर रविवार को मुझे रिपोर्ट मिलती है। आखिरकार, एक ऐसा app जिस पर मुझे भरोसा है।",
    beforePct: null,
    afterPct: null,
    savingsLabel: null,
    badge: { icon: '🛡️', label: 'DPDP Compliant' },
  },
] as const;

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={`text-sm ${i < rating ? 'text-[#BA7517]' : 'text-gray-300'}`}
          aria-hidden="true"
        >
          ★
        </span>
      ))}
    </div>
  );
}

function ProgressBar({ before, after }: { before: number; after: number }) {
  return (
    <div className="mt-4 rounded-xl border border-[#1D9E75]/20 bg-[#EAF3DE] p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#1D9E75]">
        Grade improvement
      </p>
      <div className="flex items-center gap-3">
        <span className="w-8 text-sm font-bold text-gray-400">{before}%</span>
        <div className="relative flex-1">
          <div className="h-3 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-[#1D9E75] transition-all"
              style={{ width: `${after}%` }}
              role="progressbar"
              aria-valuenow={after}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <div
            className="absolute top-0 h-3 w-0.5 bg-[#1D9E75]/50"
            style={{ left: `${before}%` }}
            aria-hidden="true"
          />
        </div>
        <span className="w-8 text-right text-sm font-bold text-[#1D9E75]">{after}%</span>
      </div>
      <p className="mt-1 text-right text-xs text-muted-foreground">After 3 months</p>
    </div>
  );
}

const TestimonialsSection = () => {
  return (
    <section id="testimonials" className="bg-[#EAF3DE]/40 py-10 md:py-14">
      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8">
        <div className="mb-8 text-center md:mb-12">
          <h2 className="font-headline text-3xl font-bold text-secondary md:text-4xl lg:text-5xl">
            Parents Trust Spinzy. Here&apos;s Why.
          </h2>
          <p className="mt-2 font-accent text-xl text-[#534AB7]">
            माता-पिता Spinzy पर भरोसा करते हैं
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {TESTIMONIALS.map((t) => (
            <article
              key={t.id}
              className="flex flex-col rounded-2xl border border-border bg-white p-6 shadow-sm"
            >
              {/* Header */}
              <div className="flex items-start gap-4 mb-4">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-headline text-lg font-bold text-white ${t.avatarColor}`}
                  aria-hidden="true"
                >
                  {t.initial}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-headline text-base font-bold text-secondary">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.location}</p>
                  <p className="text-xs text-[#534AB7]">{t.role}</p>
                </div>
                {t.badge && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#EAF3DE] px-2.5 py-1 text-xs font-semibold text-[#1D9E75]">
                    <span aria-hidden="true">{t.badge.icon}</span>
                    {t.badge.label}
                  </span>
                )}
              </div>

              <StarRow rating={t.rating} />

              {/* Quote */}
              <blockquote className="mt-3 flex-1 rounded-xl bg-gray-50 p-4 text-sm leading-relaxed text-foreground">
                &ldquo;{t.quoteEn}&rdquo;
              </blockquote>

              {/* Hindi translation for Priya */}
              {'quoteHi' in t && t.quoteHi && (
                <blockquote className="mt-2 rounded-xl bg-[#EEEDFE]/50 p-4 font-accent text-sm leading-relaxed text-foreground/80">
                  &ldquo;{t.quoteHi}&rdquo;
                </blockquote>
              )}

              {/* Progress bar for Sunita */}
              {t.beforePct !== null && t.afterPct !== null && (
                <ProgressBar before={t.beforePct} after={t.afterPct} />
              )}

              {t.savingsLabel && (
                <p className="mt-3 text-xs font-semibold text-[#534AB7]">
                  {t.savingsLabel}
                </p>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
