import type { Metadata } from 'next';
import ComingSoon from '@/components/ComingSoon';

export const metadata: Metadata = {
  title: 'Careers -- Coming Soon | Spinzy Academy',
  description: 'Join the Spinzy Academy team. Open roles in engineering, content, and growth.',
};

export default function CareersPage() {
  return (
    <ComingSoon
      title="Careers -- Coming Soon"
      description="We are building India's best AI tutoring team. Open roles in engineering, content, and growth will be listed here soon. In the meantime, reach out at hello@spinzyacademy.com."
    />
  );
}
