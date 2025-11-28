'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Icon from '@/components/UI/AppIcon';

import ConversionCTA from './ConversionCTA';
import MobileMenu from './MobileMenu';

interface NavigationItem {
  id: string;
  labelEn: string;
  labelHi: string;
  target: string;
  description: string;
}

interface StickyHeaderProps {
  activeSection?: string;
  onSectionChange?: (section: string) => void;
}

const navigationItems: NavigationItem[] = [
  {
    id: 'features',
    labelEn: 'Features',
    labelHi: 'विशेषताएं',
    target: '#solution-showcase',
    description: 'See how AI tutoring works',
  },
  {
    id: 'pricing',
    labelEn: 'Pricing',
    labelHi: 'मूल्य निर्धारण',
    target: '#pricing',
    description: 'Transparent pricing comparison',
  },
  {
    id: 'success-stories',
    labelEn: 'Success Stories',
    labelHi: 'सफलता की कहानियां',
    target: '#testimonials',
    description: 'Real parent testimonials',
  },
];

const StickyHeader = ({ activeSection = '', onSectionChange }: StickyHeaderProps) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<'en' | 'hi'>('en');

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSmoothScroll = (target: string, id: string) => {
    const element = document.querySelector(target);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      onSectionChange?.(id);
      setIsMobileMenuOpen(false);
    }
  };

  const toggleLanguage = () => {
    setCurrentLanguage((prev) => (prev === 'en' ? 'hi' : 'en'));
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-250 ${
          isScrolled ? 'bg-background shadow-card' : 'bg-background/95 backdrop-blur-sm'
        }`}
      >
        <div className="mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-[72px]">
            <Link
              href="/"
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-primary rounded-lg flex items-center justify-center">
                  <svg
                    viewBox="0 0 40 40"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-6 h-6 md:w-8 md:h-8"
                  >
                    <path d="M20 8L12 14V26L20 32L28 26V14L20 8Z" fill="white" fillOpacity="0.9" />
                    <path d="M20 14L16 17V23L20 26L24 23V17L20 14Z" fill="#000080" />
                    <circle cx="20" cy="20" r="3" fill="white" />
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="font-headline font-bold text-lg md:text-xl text-secondary leading-tight">
                    AI Tutor
                  </span>
                  <span className="font-accent text-xs text-muted-foreground leading-tight">
                    भारत का शिक्षक
                  </span>
                </div>
              </div>
            </Link>

            <nav className="hidden lg:flex items-center gap-8">
              {navigationItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSmoothScroll(item.target, item.id)}
                  className={`font-body font-medium text-sm transition-colors hover:text-primary relative group ${
                    activeSection === item.id ? 'text-primary' : 'text-foreground'
                  }`}
                  title={item.description}
                >
                  {currentLanguage === 'en' ? item.labelEn : item.labelHi}
                  {activeSection === item.id && (
                    <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full" />
                  )}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-3 md:gap-4">
              <button
                onClick={toggleLanguage}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors text-sm font-medium"
                aria-label="Toggle language"
              >
                <Icon name="LanguageIcon" size={18} variant="outline" />
                <span>{currentLanguage === 'en' ? 'हिं' : 'EN'}</span>
              </button>

              <div className="hidden lg:block">
                <ConversionCTA variant="header" />
              </div>

              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-2 hover:bg-muted rounded-md transition-colors"
                aria-label="Open menu"
              >
                <Icon name="Bars3Icon" size={24} variant="outline" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        navigationItems={navigationItems}
        activeSection={activeSection}
        currentLanguage={currentLanguage}
        onLanguageToggle={toggleLanguage}
        onNavigate={handleSmoothScroll}
      />
    </>
  );
};

export default StickyHeader;
