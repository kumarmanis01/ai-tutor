import HeroSection from './HeroSection';
import TrustBar from './TrustBar';
import TrustMoat from './TrustMoat';
import HowItWorksSection from './HowItWorksSection';
import ProblemSection from './ProblemSection';
import TestimonialsSection from './TestimonialsSection';
import PricingSection from './PricingSection';
import FAQSection from './FAQSection';
import OtpSignupForm from '@/components/auth/OtpSignupForm';
import FinalCTA from './FinalCTA';
import Footer from './Footer';

const LandingPageInteractive = () => {
  return (
    <>
      <main className="min-h-screen">
        <HeroSection />
        <TrustBar />
        {/* LP-3.1: Trust Moat — DPDP & Safety Icons Grid */}
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
