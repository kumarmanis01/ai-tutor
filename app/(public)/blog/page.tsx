import type { Metadata } from 'next';
import ComingSoon from '@/components/ComingSoon';

export const metadata: Metadata = {
  title: 'Blog -- Coming Soon | Spinzy Academy',
  description: 'Tips, guides, and study strategies for Indian students. Coming soon from Spinzy Academy.',
};

export default function BlogPage() {
  return (
    <ComingSoon
      title="Blog -- Coming Soon"
      description="We are preparing in-depth study guides, exam strategies, and parenting tips tailored for Indian families. Check back soon!"
    />
  );
}
