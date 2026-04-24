/**
 * FILE OBJECTIVE:
 * - Sticky top navigation bar for all public/marketing routes. Includes
 *   desktop nav links (How It Works, Pricing, FAQ, For Schools), mobile
 *   hamburger menu, and auth-aware CTA button.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/StickyHeader.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | LP-1.1: add For Schools link, mobile hamburger menu, fix CTA to Tangerine #FF6B35
 * - 2026-04-24T12:00:00Z | copilot | PR review: convert nav buttons to Links (href="/#section") so they work on non-landing pages
 */
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import Logo from '@/components/Logo';
import { normalizeToCode } from '@/components/LanguageSelector';
import { logger } from '@/lib/logger';


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
    labelEn: 'How It Works',
    labelHi: 'कैसे काम करता है',
    target: '#how-it-works',
    description: 'See how Vidya teaches',
  },
  {
    id: 'pricing',
    labelEn: 'Pricing',
    labelHi: 'मूल्य निर्धारण',
    target: '#pricing',
    description: 'Transparent pricing comparison',
  },
  {
    id: 'faq',
    labelEn: 'FAQ',
    labelHi: 'सामान्य प्रश्न',
    target: '#faq',
    description: 'Frequently asked questions',
  },
];

// Desktop-only nav link (not shown in mobile hamburger menu)
const desktopOnlyNavItems: NavigationItem[] = [
  {
    id: 'for-schools',
    labelEn: 'For Schools',
    labelHi: 'स्कूलों के लिए',
    target: '#schools',
    description: 'Partner with us for school programmes',
  },
];

// UI-friendly short names (used by various legacy comparisons)
const CODE_TO_PLAIN: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  ta: 'Tamil',
  bn: 'Bengali',
  fr: 'French',
  es: 'Spanish',
};

const StickyHeader = ({ activeSection = '', onSectionChange: _onSectionChange }: StickyHeaderProps) => {
  const { data: session } = useSession();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [_lang, setLang] = useState<string>('English');
  // TODO Phase 2: re-add language toggle when Hindi content is live

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Initialize language state from canonical code stored in localStorage.
  useEffect(() => {
        try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('ai-tutor:preferredLang') : null;
      if (stored) {
        const s = String(stored).trim();
        const low = s.toLowerCase();
        // handle direct codes and 'auto'
        if (low === 'auto') {
          const browser = typeof navigator !== 'undefined' ? (navigator.language || 'en') : 'en';
          const base = String(browser).split('-')[0].toLowerCase();
          setLang(CODE_TO_PLAIN[base] ?? 'English');
          return;
        }
        if (CODE_TO_PLAIN[low]) {
          setLang(CODE_TO_PLAIN[low]);
          return;
        }

        // If value looks like a display name (e.g. "हिंदी (Hindi)"), try to extract
        const m = s.match(/\(([^)]+)\)/);
        if (m && m[1]) {
          setLang(m[1]);
          return;
        }

        // Fallback: try normalizing via LanguageSelector helper
        try {
          const code = normalizeToCode(s);
          setLang(CODE_TO_PLAIN[code] ?? 'English');
          return;
        } catch {
          setLang('English');
        }
      } else if (typeof navigator !== 'undefined') {
        const t = (navigator.language || '').toLowerCase();
        if (t.startsWith('hi')) setLang('Hindi');
      }
        } catch (err) {
      logger?.warn?.('StickyHeader: failed to read preferred language', { error: err });
    }
  }, []);

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
              className="hover:opacity-80 transition-opacity"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <span className="hidden sm:flex"><Logo variant="navbar" /></span>
              <span className="flex sm:hidden"><Logo variant="navbar-mobile" /></span>
            </Link>

            {/* Desktop navigation */}
            <nav className="hidden lg:flex items-center gap-8">
              {navigationItems.map((item) => (
                // Link to /#section so navigation works from any public route, not just the landing page
                <Link
                  key={item.id}
                  href={`/${item.target}`}
                  className={`font-body font-medium text-sm transition-colors hover:text-primary relative group ${
                    activeSection === item.id ? 'text-primary' : 'text-foreground'
                  }`}
                  title={item.description}
                >
                  {item.labelEn}
                  {activeSection === item.id && (
                    <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full" />
                  )}
                </Link>
              ))}
              {/* For Schools -- desktop only */}
              {desktopOnlyNavItems.map((item) => (
                <Link
                  key={item.id}
                  href={`/${item.target}`}
                  className="font-body font-medium text-sm text-foreground transition-colors hover:text-primary"
                  title={item.description}
                >
                  {item.labelEn}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-2 md:gap-3">
              {/* Login -- visible at all screen sizes to logged-out visitors */}
              {!session && (
                <Link
                  href="/auth/signin"
                  className="text-sm font-medium text-gray-600 hover:text-[#534AB7] dark:text-gray-300 dark:hover:text-[#EEEDFE] transition-colors px-3 py-2"
                >
                  Login
                </Link>
              )}

              {/* Start Free CTA -- Tangerine #FF6B35 per LP-1.1 spec */}
              <Link
                href="/auth/signup"
                className="px-4 py-2 md:px-6 md:py-2.5 min-h-[44px] flex items-center bg-[#FF6B35] hover:bg-[#e85f2a] text-white rounded-lg text-sm font-semibold transition-colors"
              >
                Start Free
              </Link>

              {/* Hamburger -- mobile only */}
              <button
                className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-md text-foreground hover:bg-muted transition-colors"
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen((prev) => !prev)}
              >
                {mobileMenuOpen ? (
                  /* X icon */
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  /* Hamburger icon */
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-background border-t border-border shadow-lg">
            <nav className="mx-auto px-4 py-4 flex flex-col gap-1">
              {navigationItems.map((item) => (
                // Link to /#section so navigation works from any public route, not just the landing page
                <Link
                  key={item.id}
                  href={`/${item.target}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-left w-full px-4 py-3 min-h-[44px] rounded-md font-body font-medium text-sm text-foreground hover:bg-muted hover:text-primary transition-colors block"
                >
                  {item.labelEn}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>

    </>
  );
};

export default StickyHeader;
