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
    id: 'success-stories',
    labelEn: 'Success Stories',
    labelHi: 'सफलता की कहानियां',
    target: '#testimonials',
    description: 'Real parent testimonials',
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

const HINDI_ENABLED = process.env.NEXT_PUBLIC_HINDI_ENABLED === 'true';

const StickyHeader = ({ activeSection = '', onSectionChange }: StickyHeaderProps) => {
  const { data: session } = useSession();
  const [isScrolled, setIsScrolled] = useState(false);
  const [lang, setLang] = useState<string>('English');

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

  const toggleLanguage = () => {
    const next = lang === 'English' ? 'Hindi' : 'English';
    setLang(next);
    try {
      localStorage.setItem('ai-tutor:preferredLang', next === 'Hindi' ? 'hi' : 'en');
    } catch {
      // localStorage may be blocked in private mode
    }
  };

  const handleSmoothScroll = (target: string, id: string) => {
    const element = document.querySelector(target);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      onSectionChange?.(id);
    }
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
              className="hover:opacity-80 transition-opacity"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <span className="hidden sm:flex"><Logo variant="navbar" /></span>
              <span className="flex sm:hidden"><Logo variant="navbar-mobile" /></span>
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
                  {HINDI_ENABLED && lang === 'Hindi' ? item.labelHi : item.labelEn}
                  {activeSection === item.id && (
                    <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full" />
                  )}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-2 md:gap-3">
              {/* Language toggle -- shown only when Hindi content is live */}
              {HINDI_ENABLED && (
                <button
                  onClick={toggleLanguage}
                  aria-label={lang === 'English' ? 'Switch to Hindi' : 'Switch to English'}
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-surface transition-colors dark:border-border dark:hover:bg-surface"
                >
                  {lang === 'English' ? 'हिं' : 'EN'}
                </button>
              )}

              {/* Returning users: Log in link */}
              {!session && (
                <Link
                  href="/auth/login"
                  className="min-h-[44px] hidden lg:inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-foreground hover:text-primary transition-colors"
                >
                  Log in
                </Link>
              )}
              {/* Primary CTA */}
              <Link
                href={session ? '/student/onboarding' : '/auth/get-started'}
                className="min-h-[44px] inline-flex items-center px-4 py-2 md:px-6 md:py-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                {session ? 'Go to Dashboard' : 'Get started free'}
              </Link>
            </div>
          </div>
        </div>
      </header>

    </>
  );
};

export default StickyHeader;
