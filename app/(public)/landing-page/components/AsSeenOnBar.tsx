/**
 * FILE OBJECTIVE:
 * - "As Seen On" horizontal media/trust logo bar for social proof on the landing page.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/AsSeenOnBar.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T00:00:00Z | copilot | created for v3 landing page
 */

// Server component -- no 'use client' needed, no state or browser APIs

const MEDIA_LOGOS = [
  { name: 'YourStory', slug: 'yourstory' },
  { name: 'Inc42', slug: 'inc42' },
  { name: 'The Hindu', slug: 'the-hindu' },
  { name: 'EdTech Review', slug: 'edtech-review' },
  { name: 'Hindustan Times', slug: 'hindustan-times' },
];

const AsSeenOnBar = () => {
  return (
    <section className="py-6 md:py-8 bg-white border-y border-[#534AB7]/10">
      <div className="mx-auto px-4 md:px-6 lg:px-8 max-w-7xl">
        <p className="text-center text-xs md:text-sm font-medium text-muted-foreground uppercase tracking-widest mb-5">
          As Seen On
        </p>
        <div className="flex items-center justify-center gap-6 md:gap-10 flex-wrap">
          {MEDIA_LOGOS.map((logo) => (
            /*
             * TODO: Replace text placeholders with actual logo SVGs/images once assets are provided.
             * Each logo should be grayscale and rendered at ~100px width for visual consistency.
             */
            <div
              key={logo.slug}
              className="h-8 flex items-center justify-center px-4 py-1 rounded bg-muted/50 text-muted-foreground font-headline font-semibold text-sm select-none"
              aria-label={logo.name}
            >
              {logo.name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AsSeenOnBar;
