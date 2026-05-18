import Icon from '@/components/UI/AppIcon';
import { LANDING_FOOTER_SUPPORT_EMAIL } from '@/lib/email/functionalityEmails';

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
      { label: 'Data Security', href: '/data-security' },
    ],
  };

  return (
    <footer className="bg-secondary text-white">
      <div className="mx-auto px-4 md:px-6 lg:px-8 max-w-7xl py-10 md:py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-y-6 gap-x-6 md:gap-x-8 lg:gap-x-12 items-start">
          <div className="md:col-span-1">
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

            <p className="text-sm leading-relaxed opacity-80 mb-4 max-w-md">
              <strong>Spinzy AI Tutor</strong> (Teacher Vidya) -- adaptive practice and guided hints for
              Class 1-12 students. Fast, curriculum-aligned help in Hindi &amp; English.
            </p>

            <div className="flex flex-wrap gap-3 items-center mb-4">
              <a
                href="/auth/get-started"
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-semibold shadow-sm hover:bg-brand-primary-hover transition-colors"
              >
                Start For Free
              </a>
            </div>

            {/* contact icons moved to Support column for balanced layout */}
          </div>

          <div className="md:col-span-1">
            <h3 className="font-headline font-bold text-lg mb-4">Product</h3>
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

          <div className="md:col-span-1">
            <h3 className="font-headline font-bold text-lg mb-4">Support</h3>

            <div className="flex items-center gap-3 mb-3">
              <a
                href="tel:+918920754675"
                aria-label="Call us +91 89207 54675"
                className="inline-flex items-center justify-center w-11 h-11 bg-white/10 hover:bg-white/20 rounded-lg transition-colors shadow-sm"
              >
                <Icon name="PhoneIcon" size={20} variant="solid" />
              </a>

              <a
                href="https://wa.me/918920754675"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp +91 89207 54675"
                className="inline-flex items-center justify-center w-11 h-11 bg-white/10 hover:bg-white/20 rounded-lg transition-colors shadow-sm"
              >
                <Icon name="ChatBubbleLeftRightIcon" size={20} variant="solid" />
              </a>

              <a
                href={`mailto:${LANDING_FOOTER_SUPPORT_EMAIL}`}
                aria-label={`Email ${LANDING_FOOTER_SUPPORT_EMAIL}`}
                className="inline-flex items-center justify-center w-11 h-11 bg-white/10 hover:bg-white/20 rounded-lg transition-colors shadow-sm"
              >
                <Icon name="EnvelopeIcon" size={20} variant="solid" />
              </a>
            </div>

            <ul className="mt-2 space-y-2">
              <li>
                <a
                  href="/contact-us"
                  className="font-body text-sm opacity-80 hover:opacity-100 hover:text-primary transition-colors"
                >
                  Help Center
                </a>
              </li>
            </ul>
          </div>

          <div className="md:col-span-1">
            <h3 className="font-headline font-bold text-lg mb-4">Legal</h3>
            <ul className="space-y-2">
              {footerLinks.legal.map((link) => (
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
        </div>

        <div className="border-t border-white/10 mt-8 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-sm opacity-80">&copy; 2026 Spinzy Academy. All rights reserved.</p>
            <p className="text-sm opacity-70 max-w-md text-center md:text-right italic">
            Teacher Vidya is an AI assistant -- Powered by{' '}
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
