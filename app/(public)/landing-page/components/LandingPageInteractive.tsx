/**
 * FILE OBJECTIVE:
 * - Compose full landing page interactive sections with server-side SEO markup.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/landing-page-interactive.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-26T00:00:00Z | copilot | add FAQSchemaMarkup server component for SEO, move JSON-LD from client
 */

import HeroSection from './HeroSection';
import TrustBar from './TrustBar';
import TrustMoat from './TrustMoat';
import HowItWorksSection from './HowItWorksSection';
import ProblemSection from './ProblemSection';
import TestimonialsSection from './TestimonialsSection';
import PricingSection from './PricingSection';
import FAQSection from './FAQSection';
import { FAQSchemaMarkup } from './FAQSchemaMarkup';
import OtpSignupForm from '@/components/auth/OtpSignupForm';
import FinalCTA from './FinalCTA';
import Footer from './Footer';

const LandingPageInteractive = () => {
  return (
    <>
      <FAQSchemaMarkup />
      <main className="min-h-screen">
        <HeroSection />
        <TrustBar />
        {/* LP-3.1: Trust Moat -- DPDP & Safety Icons Grid */}
        <TrustMoat />
        <HowItWorksSection />
        <ProblemSection />
        <TestimonialsSection />
        <PricingSection />
        <FAQSection />
        {/* Mid-funnel email capture -- after objections are handled */}
        <section className="py-10 bg-[#EEEDFE]/50 border-y border-[#534AB7]/10">
          <div className="mx-auto px-4 md:px-6 max-w-xl text-center">
            <p className="font-headline font-bold text-xl text-secondary mb-1">
              Ready to try it yourself?
            </p>
            <p className="font-accent text-sm text-[#534AB7] mb-5">
              आज ही शुरू करें -- बिल्कुल मुफ्त
            </p>
            <OtpSignupForm />
            <p className="text-xs text-muted-foreground mt-3">
              3 free sessions every month. No credit card required.
            </p>
          </div>
        </section>
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
};

export default LandingPageInteractive;
