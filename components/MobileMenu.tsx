'use client';

import { useEffect } from 'react';
import Icon from '@/components/UI/AppIcon';
import ConversionCTA from './ConversionCTA';

interface NavigationItem {
  id: string;
  labelEn: string;
  labelHi: string;
  target: string;
  description: string;
}

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  navigationItems: NavigationItem[];
  activeSection?: string;
  currentLanguage: 'en' | 'hi';
  onLanguageToggle: () => void;
  onNavigate: (target: string, id: string) => void;
}

const MobileMenu = ({
  isOpen,
  onClose,
  navigationItems,
  activeSection = '',
  currentLanguage,
  onLanguageToggle,
  onNavigate,
}: MobileMenuProps) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-foreground/60 backdrop-blur-sm z-[150] lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={`
          fixed top-0 right-0 bottom-0 w-[280px] sm:w-[320px]
          bg-background shadow-2xl z-[200]
          transform transition-transform duration-300 ease-in-out
          lg:hidden
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <svg
                  viewBox="0 0 40 40"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5"
                >
                  <path d="M20 8L12 14V26L20 32L28 26V14L20 8Z" fill="white" fillOpacity="0.9" />
                  <path d="M20 14L16 17V23L20 26L24 23V17L20 14Z" fill="#000080" />
                  <circle cx="20" cy="20" r="3" fill="white" />
                </svg>
              </div>
              <span className="font-headline font-bold text-lg text-secondary">AI Tutor</span>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-md transition-colors"
              aria-label="Close menu"
            >
              <Icon name="XMarkIcon" size={24} variant="outline" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-6 px-4">
            <div className="space-y-2">
              {navigationItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.target, item.id)}
                  className={`
                    w-full flex items-center justify-between px-4 py-3 rounded-lg
                    font-body font-medium text-left transition-colors
                    ${
                      activeSection === item.id
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted text-foreground'
                    }
                  `}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-base">
                      {currentLanguage === 'en' ? item.labelEn : item.labelHi}
                    </span>
                    <span className="text-xs text-muted-foreground">{item.description}</span>
                  </div>
                  <Icon
                    name="ChevronRightIcon"
                    size={20}
                    variant="outline"
                    className={activeSection === item.id ? 'text-primary' : 'text-muted-foreground'}
                  />
                </button>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-border space-y-4">
              <button
                onClick={onLanguageToggle}
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Icon name="LanguageIcon" size={20} variant="outline" />
                  <span className="font-body font-medium">
                    {currentLanguage === 'en' ? 'Switch to Hindi' : 'Switch to English'}
                  </span>
                </div>
                <span className="text-sm font-medium text-muted-foreground">
                  {currentLanguage === 'en' ? 'हिं' : 'EN'}
                </span>
              </button>

              <a
                href="tel:+911234567890"
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted transition-colors"
              >
                <Icon name="PhoneIcon" size={20} variant="outline" />
                <div className="flex flex-col">
                  <span className="font-body font-medium text-sm">Contact Support</span>
                  <span className="text-xs text-muted-foreground">+91 123 456 7890</span>
                </div>
              </a>

              <a
                href="mailto:support@aitutor.in"
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted transition-colors"
              >
                <Icon name="EnvelopeIcon" size={20} variant="outline" />
                <div className="flex flex-col">
                  <span className="font-body font-medium text-sm">Email Us</span>
                  <span className="text-xs text-muted-foreground">support@aitutor.in</span>
                </div>
              </a>
            </div>
          </nav>

          <div className="p-4 border-t border-border">
            <ConversionCTA variant="hero" className="w-full" onClick={onClose} />
            <p className="mt-3 text-center text-xs text-muted-foreground">
              No Credit Card Required • 100% Safe & Private
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default MobileMenu;
