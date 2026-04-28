import type { Metadata } from 'next';
import ComingSoon from '@/components/ComingSoon';

export const metadata: Metadata = {
  title: 'Press Kit -- Coming Soon | Spinzy Academy',
  description: 'Spinzy Academy press kit: logos, brand assets, and media enquiries.',
};

export default function PressPage() {
  return (
    <ComingSoon
      title="Press Kit -- Coming Soon"
      description="Logos, brand assets, and fact sheets for journalists and media partners will be available here. For urgent media enquiries, please email hello@spinzyacademy.com."
    />
  );
}
