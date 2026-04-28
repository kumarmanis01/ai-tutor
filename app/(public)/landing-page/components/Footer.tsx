/**
 * FILE OBJECTIVE:
 * - LP-9.1 global footer with product navigation, student/parent/schools/company/legal link groups,
 *   social links, and demo modal trigger.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/Footer.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | LP-1.1/LP-9.1: add social links, Made in India marker, DPDP link
 * - 2026-04-24T12:00:00Z | copilot | mark as client component so it can safely import AppIcon (client component)
 * - 2026-04-27T00:00:00Z | copilot | v3: 5-column layout, add WhatsApp/Instagram/YouTube social links
 * - 2026-04-27T14:30:00Z | copilot | LP-9.1: replace footer information architecture and add demo modal action
 * - 2026-04-27T15:00:00Z | copilot | fix(review): replace invalid WhatsApp channel href; pass explicit embedUrl to VideoModal
 * - 2026-04-28T00:00:00Z | copilot | LP-1.1: align footer social icons to Twitter and LinkedIn while keeping contact links
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import VideoModal from './VideoModal';

const Footer = () => {
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  // TODO(media): replace with real Spinzy demo video URL once produced
  const DEMO_VIDEO_URL = 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0&modestbranding=1';

  const productLinks = [
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Features', href: '#features' },
    { label: 'Free Tier', href: '#pricing' },
  ];

  const studentLinks = [
    { label: 'Learning Map', href: '/register' },
    { label: 'Practice Questions', href: '/register' },
    { label: 'Mock Tests', href: '/register' },
    { label: 'AI Tutor', href: '/register' },
    { label: 'Study Buddy', href: '/register' },
  ];

  const parentLinks = [
    { label: 'Parent Dashboard', href: '/auth/signin?callbackUrl=/parent-onboarding' },
    { label: 'Progress Reports', href: '/auth/signin?callbackUrl=/parent-onboarding' },
    { label: 'Assignments', href: '/auth/signin?callbackUrl=/parent-onboarding' },
    { label: 'Weekly Reports', href: '/auth/signin?callbackUrl=/parent-onboarding' },
  ];

  const schoolLinks = [
    { label: 'School Partnership', href: '#schools' },
    { label: 'Teacher Dashboard', href: 'mailto:schools@spinzyacademy.com' },
    { label: 'Contact Sales', href: 'mailto:schools@spinzyacademy.com' },
  ];

  const companyLinks = [
    { label: 'About Us', href: '/about' },
    { label: 'Blog', href: '/blog' },
    { label: 'Careers', href: '/careers' },
    { label: 'Press Kit', href: '/press' },
  ];

  const legalLinks = [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'DPDP Compliance', href: '/dpdp' },
    { label: 'Refund Policy', href: '/refund' },
    { label: 'Cookie Policy', href: '/cookies' },
  ];

  return (
    <>
      <footer className="bg-[#1A2E45] text-white">
        <div className="mx-auto px-4 md:px-6 lg:px-8 max-w-7xl py-10 md:py-14">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-y-8 gap-x-6 items-start">
            <div className="sm:col-span-2 lg:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shrink-0">
                  <svg
                    viewBox="0 0 40 40"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-7 h-7"
                  >
                    <path d="M20 8L12 14V26L20 32L28 26V14L20 8Z" fill="white" fillOpacity="0.9" />
                    <path d="M20 14L16 17V23L20 26L24 23V17L20 14Z" fill="#000080" />
                    <circle cx="20" cy="20" r="3" fill="white" />
                  </svg>
                </div>
                <div>
                  <span className="font-headline font-bold text-lg">Spinzy Academy</span>
                  <p className="font-accent text-xs opacity-80">AI Home Tutor for Indian Students</p>
                </div>
              </div>

              <p className="text-sm leading-relaxed opacity-80 mb-3">
                Student-first learning for Indian families. Board-aligned practice, AI guidance, and
                clear parent visibility.
              </p>

              <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold mb-4">
                <span aria-hidden="true">🇮🇳</span>
                Made in India
              </p>

              <div className="flex items-center gap-2 flex-wrap mb-4">
                <a
                  href="https://x.com/spinzyacademy"
                  aria-label="Follow Spinzy Academy on Twitter"
                  className="inline-flex items-center justify-center w-9 h-9 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                    <path d="M18.901 1.153h3.68l-8.04 9.188L24 22.847h-7.406l-5.8-7.584-6.637 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.933Zm-1.291 19.49h2.039L6.486 3.24H4.298L17.61 20.643Z" />
                  </svg>
                </a>

                <a
                  href="https://www.linkedin.com/company/spinzyacademy"
                  aria-label="Follow Spinzy Academy on LinkedIn"
                  className="inline-flex items-center justify-center w-9 h-9 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </a>
              </div>

              <p className="text-sm opacity-80">hello@spinzyacademy.com</p>
              <p className="text-sm opacity-80">+91-89207-54675</p>
              <a href="https://wa.me/918920754675" className="text-sm opacity-80 hover:opacity-100">
                WhatsApp Support
              </a>
            </div>

            <div>
              <h3 className="font-headline font-bold text-sm mb-3 opacity-90">Product</h3>
              <ul className="space-y-2">
                {productLinks.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="font-body text-sm opacity-70 hover:opacity-100 hover:text-primary transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={() => setIsDemoOpen(true)}
                    className="font-body text-sm opacity-70 hover:opacity-100 hover:text-primary transition-colors"
                  >
                    Demo
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-headline font-bold text-sm mb-3 opacity-90">For Students</h3>
              <ul className="space-y-2">
                {studentLinks.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="font-body text-sm opacity-70 hover:opacity-100 hover:text-primary transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-headline font-bold text-sm mb-3 opacity-90">For Parents</h3>
              <ul className="space-y-2">
                {parentLinks.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="font-body text-sm opacity-70 hover:opacity-100 hover:text-primary transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-headline font-bold text-sm mb-3 opacity-90">For Schools</h3>
              <ul className="space-y-2 mb-6">
                {schoolLinks.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="font-body text-sm opacity-70 hover:opacity-100 hover:text-primary transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>

              <h3 className="font-headline font-bold text-sm mb-3 opacity-90">Company</h3>
              <ul className="space-y-2 mb-6">
                {companyLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="font-body text-sm opacity-70 hover:opacity-100 hover:text-primary transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>

              <h3 className="font-headline font-bold text-sm mb-3 opacity-90">Legal</h3>
              <ul className="space-y-2">
                {legalLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="font-body text-sm opacity-70 hover:opacity-100 hover:text-primary transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="sm:col-span-2 lg:col-span-7 border-t border-white/10 pt-6 mt-2">
              <p className="text-sm opacity-80 text-center">© 2026 Spinzy Academy. All rights reserved.</p>
            </div>
          </div>

          <VideoModal isOpen={isDemoOpen} onClose={() => setIsDemoOpen(false)} embedUrl={DEMO_VIDEO_URL} />
        </div>
      </footer>
    </>
  );
};

export default Footer;
