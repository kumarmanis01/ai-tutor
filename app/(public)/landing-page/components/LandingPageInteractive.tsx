'use client';

import { useState } from 'react';
import StickyHeader from '@/components/StickyHeader';
import HeroSection from './HeroSection';
import TrustBar from './TrustBar';
import ProblemSection from './ProblemSection';
import TestimonialsSection from './TestimonialsSection';
import PricingSection from './PricingSection';
import FAQSection from './FAQSection';
import SignupFormEmailWidget from './SignupFormEmailWidget';
import FinalCTA from './FinalCTA';
import Footer from './Footer';

const LandingPageInteractive = () => {
  const [activeSection, setActiveSection] = useState('');
  const [showDemoModal, setShowDemoModal] = useState(false);

  const handleDemoClick = () => {
    setShowDemoModal(true);
  };

  return (
    <>
      <StickyHeader activeSection={activeSection} onSectionChange={setActiveSection} />
      <main className="min-h-screen">
        <HeroSection onDemoClick={handleDemoClick} />
        <TrustBar />
        <ProblemSection />
        <SignupFormEmailWidget />
        <TestimonialsSection />
        <PricingSection />
        <FAQSection />
        <SignupFormEmailWidget />
        <FinalCTA />
      </main>
      <Footer />
      {showDemoModal && (
        <div
          className="fixed inset-0 bg-foreground/80 backdrop-blur-sm z-[300] flex items-center justify-center p-4"
          onClick={() => setShowDemoModal(false)}
        >
          <div
            className="bg-background rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
            onClick={(e) => e?.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="font-headline font-bold text-2xl text-secondary">
                AI Tutor Demo Video
              </h3>
              <button
                onClick={() => setShowDemoModal(false)}
                className="w-10 h-10 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>
            <div className="aspect-video bg-muted flex items-center justify-center">
              <p className="font-body text-muted-foreground">
                Demo video player would be embedded here
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LandingPageInteractive;
