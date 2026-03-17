'use client';

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

const LandingPageInteractive = () => {
  return (
    <>
      <main className="min-h-screen">
        <HeroSection />
        <TrustBar />
        <HowItWorksSection />
        <ProblemSection />
        <OtpSignupForm />
        <TestimonialsSection />
        <PricingSection />
        <FAQSection />
        <OtpSignupForm />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
};

export default LandingPageInteractive;
