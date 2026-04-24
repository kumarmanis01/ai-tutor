/**
 * FILE OBJECTIVE:
 * - Global footer for all public/marketing pages. Three-column layout with
 *   product links, contact info, legal links, social links, and Play Store badge.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/Footer.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | LP-1.1/LP-9.1: add social links (Twitter/LinkedIn),
 *   Made in India marker, DPDP Compliance link, Play Store badge, contact info
 * - 2026-04-24T12:00:00Z | copilot | mark as client component so it can safely import AppIcon (client component)
 */
'use client';

import Link from 'next/link';
import Icon from '@/components/UI/AppIcon';

const Footer = () => {
  const footerLinks = {
    product: [
      { label: 'How It Works', href: '#how-it-works' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'Success Stories', href: '#testimonials' },
      { label: 'FAQ', href: '#faq' },
    ],
    support: [
      { label: 'Help Center', href: '/contact-us' },
    ],
    legal: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Refund Policy', href: '/refund' },
      { label: 'DPDP Compliance', href: '/data-security' },
    ],
  };

  return (
    <footer className="bg-secondary text-white">
      <div className="mx-auto px-4 md:px-6 lg:px-8 max-w-7xl py-10 md:py-14">
        {/* Three columns: Brand / Links / Contact */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-y-8 gap-x-8 lg:gap-x-16 items-start">
          {/* Column 1: Brand */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
                  <path d="M20 8L12 14V26L20 32L28 26V14L20 8Z" fill="white" fillOpacity="0.9" />
                  <path d="M20 14L16 17V23L20 26L24 23V17L20 14Z" fill="#000080" />
                  <circle cx="20" cy="20" r="3" fill="white" />
                </svg>
              </div>
              <div>
                <span className="font-headline font-bold text-xl">Spinzy Academy</span>
                <p className="font-accent text-sm opacity-80">AI-powered Home Tuition</p>
              </div>
            </div>

            <p className="text-sm leading-relaxed opacity-80 mb-4">
              <strong>Spinzy AI Tutor</strong> (Teacher Vidya) — adaptive practice and guided hints for
              Class 1-12 students. Fast, curriculum-aligned help in Hindi &amp; English.
            </p>

            <p className="text-sm opacity-70 mb-5">
              Spinzy Academy &copy; 2026. Made in India 🇮🇳
            </p>

            {/* Social links — Twitter/LinkedIn only, no Facebook */}
            <div className="flex items-center gap-3">
              <a
                href="https://twitter.com/spinzyacademy"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow Spinzy Academy on Twitter / X"
                className="inline-flex items-center justify-center w-10 h-10 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                {/* Twitter / X icon */}
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="https://www.linkedin.com/company/spinzyacademy"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow Spinzy Academy on LinkedIn"
                className="inline-flex items-center justify-center w-10 h-10 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                {/* LinkedIn icon */}
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Column 2: Links */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="font-headline font-bold text-base mb-3">Product</h3>
              <ul className="space-y-2">
                {footerLinks.product.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="font-body text-sm opacity-80 hover:opacity-100 hover:text-primary transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-headline font-bold text-base mb-3">Legal</h3>
              <ul className="space-y-2">
                {footerLinks.legal.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="font-body text-sm opacity-80 hover:opacity-100 hover:text-primary transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Column 3: Contact */}
          <div>
            <h3 className="font-headline font-bold text-base mb-3">Contact</h3>
            <ul className="space-y-3 mb-4">
              <li>
                <a
                  href="mailto:hello@spinzyacademy.com"
                  className="font-body text-sm opacity-80 hover:opacity-100 hover:text-primary transition-colors flex items-center gap-2"
                >
                  <Icon name="EnvelopeIcon" size={16} variant="solid" />
                  hello@spinzyacademy.com
                </a>
              </li>
              <li>
                <a
                  href="tel:+918920754675"
                  className="font-body text-sm opacity-80 hover:opacity-100 hover:text-primary transition-colors flex items-center gap-2"
                >
                  <Icon name="PhoneIcon" size={16} variant="solid" />
                  +91 89207 54675
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/918920754675"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-body text-sm opacity-80 hover:opacity-100 hover:text-primary transition-colors flex items-center gap-2"
                >
                  <Icon name="ChatBubbleLeftRightIcon" size={16} variant="solid" />
                  WhatsApp Support
                </a>
              </li>
              <li>
                <Link
                  href="/contact-us"
                  className="font-body text-sm opacity-80 hover:opacity-100 hover:text-primary transition-colors flex items-center gap-2"
                >
                  <Icon name="QuestionMarkCircleIcon" size={16} variant="solid" />
                  Help Center
                </Link>
              </li>
            </ul>

            {/* Play Store badge — rendered only when NEXT_PUBLIC_ANDROID_APP_URL is set */}
            {process.env.NEXT_PUBLIC_ANDROID_APP_URL ? (
              <a
                href={process.env.NEXT_PUBLIC_ANDROID_APP_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Download Spinzy Academy on Google Play"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm font-medium"
              >
                {/* Google Play icon placeholder */}
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
                  <path d="M3.18 23.76c.33.18.72.17 1.05-.03L15.7 17.2l-3.14-3.14L3.18 23.76zm-1.06-19.9C2.04 4.15 2 4.46 2 4.8v14.4c0 .34.04.65.12.94l9.42-9.42-9.42-9.85zM20.82 10.6l-2.96-1.7-3.46 3.46 3.46 3.46 2.98-1.72c.85-.49.85-1.01 0-1.5zM4.23.27C3.9.07 3.51.06 3.18.24l9.37 9.38 3.14-3.14L4.23.27z" />
                </svg>
                Download on Play Store
              </a>
            ) : null}
          </div>
        </div>

        <div className="border-t border-white/10 mt-8 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-sm opacity-80">&copy; 2026 Spinzy Academy. All rights reserved.</p>
          <p className="text-sm opacity-70 max-w-md text-center md:text-right italic">
            Teacher Vidya is an AI assistant — Powered by{' '}
            <a
              href="https://spinzydigital.com"
              className="hover:opacity-100 transition-colors underline"
            >
              SpinzyDigital
            </a>
            .
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
