/**
 * FILE OBJECTIVE:
 * - LP-3.1 trust moat section with four safety cards and a static parent dashboard
 *   preview image rendered inside a phone mockup.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/TrustMoat.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | LP-3.1: created TrustMoat component with 4-card grid
 *   and parent dashboard preview mockup
 * - 2026-04-24T12:00:00Z | copilot | mark as client component: uses onClick handlers and document API
 * - 2026-04-28T00:00:00Z | copilot | LP-3.1: replace mock dashboard UI with static image preview and internal link
 * - 2026-04-28T00:00:00Z | copilot | fix(review): remove blur placeholder from non-static image source to avoid Next Image runtime error
 */

import Image from 'next/image';
import Link from 'next/link';

interface TrustCardData {
  emoji: string;
  emojiLabel: string;
  titleEn: string;
  descEn: string;
}

const parentDashboardPreview = {
  src: '/images/parent-dashboard-preview.png',
  width: 360,
  height: 640,
} as const;

const TRUST_CARDS: TrustCardData[] = [
  {
    emoji: '🛡️',
    emojiLabel: 'Shield',
    titleEn: 'DPDP Compliant',
    descEn:
      "We follow India's Digital Personal Data Protection Act. Your child's data is processed lawfully, with your consent.",
  },
  {
    emoji: '👁️',
    emojiLabel: 'Eye with slash',
    titleEn: 'No Tracking',
    descEn:
      "We don't monitor your child's behavior for advertising. No third-party trackers. No data sold.",
  },
  {
    emoji: '📵',
    emojiLabel: 'Phone with lock',
    titleEn: 'No Social Features',
    descEn: 'No chat rooms. No friend requests. No reels. Just focused learning with an AI tutor.',
  },
  {
    emoji: '🇮🇳',
    emojiLabel: 'Indian flag',
    titleEn: 'Data Stays in India',
    descEn: 'All data is stored on servers in Mumbai. Encrypted at rest and in transit.',
  },
];

function TrustCard({ card }: { card: TrustCardData }) {
  return (
    <div className="rounded-2xl border border-[#534AB7]/10 bg-white p-5 text-center transition-shadow duration-200 hover:shadow-md md:text-left">
      <span role="img" aria-label={card.emojiLabel} className="mb-3 block text-3xl leading-none">
        {card.emoji}
      </span>
      <h3 className="mb-1 font-headline text-base font-bold text-secondary">{card.titleEn}</h3>
      <p className="font-body text-sm leading-relaxed text-muted-foreground">{card.descEn}</p>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="mt-10 flex flex-col items-center md:mt-12">
      <div className="w-full max-w-sm">
        <div className="rounded-[2rem] border-4 border-secondary bg-secondary p-3 shadow-2xl">
          <div className="overflow-hidden rounded-[1.55rem] bg-white">
            <Image
              src={parentDashboardPreview}
              alt="Parent dashboard preview showing weak topics, screen time toggle, and subject blocker controls"
              className="h-auto w-full"
              sizes="(max-width: 768px) 80vw, 360px"
            />
          </div>
        </div>
      </div>

      <p className="mt-5 max-w-md text-center font-body text-sm text-muted-foreground md:text-base">
        See every topic your child studies. Set limits. Block subjects. All from your phone.
      </p>
      <Link
        href="/#how-it-works"
        className="mt-2 text-sm font-semibold text-[#534AB7] transition-colors hover:underline"
      >
        Learn more about Parent Controls →
      </Link>
    </div>
  );
}

const TrustMoat = () => {
  return (
    <section className="bg-[#F4F7FC] py-12 md:py-16">
      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8">
        <div className="mb-8 text-center md:mb-12">
          <h2 className="font-headline text-2xl font-bold text-secondary md:text-3xl lg:text-4xl">
            Built for Indian Parents. Designed for Indian Law.
          </h2>
          <p className="mt-2 font-accent text-lg text-[#534AB7] md:text-xl">
            माता-पिता के लिए बनाया गया। भारतीय कानून के अनुसार।
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 md:gap-6">
          {TRUST_CARDS.map((card) => (
            <TrustCard key={card.titleEn} card={card} />
          ))}
        </div>

        <DashboardPreview />
      </div>
    </section>
  );
};

export default TrustMoat;
