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

const StickyHeader = ({ activeSection = '', onSectionChange }: StickyHeaderProps) => {
  const { data: session } = useSession();
  const [isScrolled, setIsScrolled] = useState(false);
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
                  {item.labelEn}
                  {activeSection === item.id && (
                    <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full" />
                  )}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-2 md:gap-3">
              {/* Login -- visible at all screen sizes to logged-out visitors */}
              {/* {!session && (
                <Link
                  href="/auth/signin"
                  className="text-sm font-medium text-gray-600 hover:text-[#534AB7] dark:text-gray-300 dark:hover:text-[#EEEDFE] transition-colors px-3 py-2"
                >
                  Login
                </Link>
              )} */}

              {/* Start Free -- navigates directly to /auth/signup */}
              <Link
                href="/auth/signup"
                className="px-4 py-2 md:px-6 md:py-2.5 bg-[#534AB7] hover:bg-[#4338A0] text-white rounded-lg text-sm font-semibold transition-colors"
              >
                Start Learning Now!
              </Link>
            </div>
          </div>
        </div>
      </header>

    </>
  );
};

export default StickyHeader;
