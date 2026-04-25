/**
 * FILE OBJECTIVE:
 * - LP-3.1 Trust Moat section: 4-card grid highlighting DPDP compliance, no tracking,
 *   no social features, and data stays in India. Includes parent dashboard preview.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/TrustMoat.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | LP-3.1: created TrustMoat component with 4-card grid
 *   and parent dashboard preview mockup
 * - 2026-04-24T12:00:00Z | copilot | mark as client component: uses onClick handlers and document API
 */
'use client';

interface TrustCardData {
  emoji: string;
  emojiLabel: string;
  titleEn: string;
  descEn: string;
}

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

// Sub-component: individual trust card
function TrustCard({ card }: { card: TrustCardData }) {
  return (
    <div className="flex flex-col items-center text-center md:items-start md:text-left p-5 bg-white rounded-2xl border border-[#534AB7]/10 hover:shadow-md transition-shadow duration-250">
      <span role="img" aria-label={card.emojiLabel} className="text-3xl mb-3 leading-none">
        {card.emoji}
      </span>
      <h3 className="font-headline font-bold text-base text-secondary mb-1">{card.titleEn}</h3>
      <p className="font-body text-sm text-muted-foreground leading-relaxed">{card.descEn}</p>
    </div>
  );
}

// Sub-component: parent dashboard preview inside phone mockup
function DashboardPreview() {
  return (
    <div className="flex flex-col items-center mt-10 md:mt-12">
      <div className="w-full max-w-sm mx-auto">
        {/* Phone mockup frame */}
        <div className="relative bg-secondary rounded-[2rem] p-3 shadow-2xl border-4 border-secondary">
          <div className="bg-white rounded-[1.5rem] overflow-hidden">
            {/* Status bar */}
            <div className="bg-[#534AB7] px-4 py-2 flex items-center justify-between">
              <span className="text-white text-xs font-bold">Parent Dashboard</span>
              <span className="text-white/80 text-[10px]">9:41 AM</span>
            </div>
            {/* Dashboard content mockup */}
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between bg-[#EEEDFE] rounded-xl p-3">
                <div>
                  <p className="text-xs font-bold text-secondary">Weak Topics</p>
                  <p className="text-[10px] text-[#534AB7]">Algebra · Photosynthesis</p>
                </div>
                <span className="text-lg">📊</span>
              </div>
              <div className="flex items-center justify-between bg-[#EAF3DE] rounded-xl p-3">
                <div>
                  <p className="text-xs font-bold text-secondary">Screen Time Today</p>
                  <p className="text-[10px] text-[#1D9E75]">47 min / 60 min limit</p>
                </div>
                <div className="w-8 h-4 bg-[#1D9E75] rounded-full relative">
                  <div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full shadow" />
                </div>
              </div>
              <div className="flex items-center justify-between bg-[#FCEBEB] rounded-xl p-3">
                <div>
                  <p className="text-xs font-bold text-secondary">Subject Blocker</p>
                  <p className="text-[10px] text-[#E24B4A]">Social Studies -- Blocked</p>
                </div>
                <div className="w-8 h-4 bg-gray-200 rounded-full relative">
                  <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full shadow" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="font-body text-sm md:text-base text-muted-foreground mt-5 text-center max-w-md">
        See every topic your child studies. Set limits. Block subjects. All from your phone.
      </p>
      <a
        href="#how-it-works"
        className="mt-2 text-sm font-semibold text-[#534AB7] hover:underline transition-colors"
        onClick={(e) => {
          e.preventDefault();
          document
            .querySelector('#how-it-works')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
      >
        Learn more about Parent Controls &rarr;
      </a>
    </div>
  );
}

const TrustMoat = () => {
  return (
    <section className="py-12 md:py-16 bg-[#F4F7FC]">
      <div className="mx-auto px-4 md:px-6 lg:px-8 max-w-7xl">
        {/* Section headline -- bilingual per LP-3.1 spec */}
        <div className="text-center mb-8 md:mb-12">
          <h2 className="font-headline font-bold text-2xl md:text-3xl lg:text-4xl text-secondary">
            Built for Indian Parents. Designed for Indian Law.
          </h2>
          <p className="font-accent text-lg md:text-xl text-[#534AB7] mt-2">
            माता-पिता के लिए बनाया गया। भारतीय कानून के अनुसार।
          </p>
        </div>

        {/* 4-card grid: 2x2 on mobile, 4-col on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {TRUST_CARDS.map((card) => (
            <TrustCard key={card.titleEn} card={card} />
          ))}
        </div>

        {/* Parent dashboard preview card */}
        <DashboardPreview />
      </div>
    </section>
  );
};

export default TrustMoat;
