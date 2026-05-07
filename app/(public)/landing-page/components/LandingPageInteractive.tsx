import HeroSection from './HeroSection';
import TrustBar from './TrustBar';
import HowItWorksSection from './HowItWorksSection';
import ProblemSection from './ProblemSection';
import TestimonialsSection from './TestimonialsSection';
import PricingSection from './PricingSection';
import FAQSection from './FAQSection';
import OtpSignupForm from '@/components/auth/OtpSignupForm';
import FinalCTA from './FinalCTA';
import Footer from './Footer';
import { FREE_SESSIONS_TEXT } from '@/lib/constants/freeTier';
import { FREE_SESSIONS_TEXT_HI } from '@/lib/constants/freeTier';

const LandingPageInteractive = () => {
  return (
    <>
      <main className="min-h-screen">
        <HeroSection />
        <TrustBar />
        <HowItWorksSection />
        <ProblemSection />
        <TestimonialsSection />
        <PricingSection />
        <FAQSection />
        {/* Mid-funnel email capture -- after objections are handled */}
        <section className="py-10 bg-brand-primary-bg/50 border-y border-brand-primary/10">
          <div className="mx-auto px-4 md:px-6 max-w-xl text-center">
            <p className="font-headline font-bold text-xl text-secondary mb-1">
              Ready to try it yourself?
            </p>
            <p className="font-accent text-sm text-brand-primary mb-5">
              {FREE_SESSIONS_TEXT_HI}
            </p>
            <OtpSignupForm />
            <p className="text-xs text-muted-foreground mt-3">
              {FREE_SESSIONS_TEXT}
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
