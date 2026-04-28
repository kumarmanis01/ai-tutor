import type { Metadata } from 'next';
import ComingSoon from '@/components/ComingSoon';

export const metadata: Metadata = {
  title: 'Cookie Policy | Spinzy Academy',
  description: 'How Spinzy Academy uses cookies and similar technologies.',
};

export default function CookiesPage() {
  return (
    <ComingSoon
      title="Cookie Policy"
      description="Our detailed cookie policy explaining exactly which cookies we use, why, and how you can control them is being finalised. It will be live here shortly."
    />
  );
}
