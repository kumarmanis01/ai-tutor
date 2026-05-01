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
 * - 2026-04-27T00:00:00Z | copilot | v3: add new sections in v3 order, remove OtpSignupForm mid-funnel block
 */

import HeroSection from './HeroSection';
// import AsSeenOnBar from './AsSeenOnBar';
import TrustBar from './TrustBar';
import TrustMoat from './TrustMoat';
import HowItWorksSection from './HowItWorksSection';
import FeaturesGrid from './FeaturesGrid';
import TestimonialsSection from './TestimonialsSection';
import BoardSpecificSection from './BoardSpecificSection';
import PricingSection from './PricingSection';
import FAQSection from './FAQSection';
import { FAQSchemaMarkup } from './FAQSchemaMarkup';
import SchoolsBanner from './SchoolsBanner';
import NewsletterSignup from './NewsletterSignup';
import CookieConsentBanner from './CookieConsentBanner';
import FinalCTA from './FinalCTA';
import Footer from './Footer';

const LandingPageInteractive = () => {
  return (
    <>
      <FAQSchemaMarkup />
      <main className="min-h-screen">
        <HeroSection />
        {/* <AsSeenOnBar /> */}
        <TrustBar />
        {/* LP-3.1: Trust Moat -- DPDP & Safety Icons Grid */}
        <TrustMoat />
        <HowItWorksSection />
        <FeaturesGrid />
        <TestimonialsSection />
        <BoardSpecificSection />
        <PricingSection />
        <FAQSection />
        <SchoolsBanner />
        <NewsletterSignup />
        <FinalCTA />
      </main>
      <Footer />
      <CookieConsentBanner />
    </>
  );
};

export default LandingPageInteractive;
