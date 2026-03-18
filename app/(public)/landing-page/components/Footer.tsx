'use client';

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
      { label: 'Call us: +91 89207 54675', href: 'tel:+918920754675' },
      { label: '💬 WhatsApp us: +91 89207 54675', href: 'https://wa.me/918920754675' },
      { label: 'Email: support@spinzyacademy.com', href: 'mailto:support@spinzyacademy.com' },
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
      <div className="mx-auto px-4 md:px-6 lg:px-8 max-w-7xl py-12 md:py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                <svg
                  viewBox="0 0 40 40"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-8 h-8"
                >
                  <path d="M20 8L12 14V26L20 32L28 26V14L20 8Z" fill="white" fillOpacity="0.9" />
                  <path d="M20 14L16 17V23L20 26L24 23V17L20 14Z" fill="#000080" />
                  <circle cx="20" cy="20" r="3" fill="white" />
                </svg>
              </div>
              <div>
                <span className="font-headline font-bold text-xl">Spinzy</span>
                <p className="font-accent text-sm opacity-80">भारत का शिक्षक</p>
              </div>
            </div>
            <p className="font-body text-sm opacity-80 mb-4 max-w-sm">
              AI-powered tutoring for Class 1–12 students. Affordable, personalised, and available
              24×7 in Hindi and English. Aligned with CBSE, ICSE &amp; State Boards.
            </p>
            <div className="flex gap-3">
              <a
                href="tel:+918920754675"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm"
              >
                <Icon name="PhoneIcon" size={18} variant="solid" />
                <span>Call Us</span>
              </a>
              <a
                href="mailto:support@spinzyacademy.com"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm"
              >
                <Icon name="EnvelopeIcon" size={18} variant="solid" />
                <span>Email</span>
              </a>
            </div>
          </div>

          <div>
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

          <div>
            <h3 className="font-headline font-bold text-lg mb-4">Support</h3>
            <ul className="space-y-2">
              {footerLinks.support.map((link) => (
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

        <div className="border-t border-white/10 pt-8">
          <p className="font-body text-sm opacity-80 text-center">
            &copy; 2026 Spinzy Academy. All rights reserved. Made with ❤️ for Indian students.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
