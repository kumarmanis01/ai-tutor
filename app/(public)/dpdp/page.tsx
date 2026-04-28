import type { Metadata } from 'next';
import ComingSoon from '@/components/ComingSoon';

export const metadata: Metadata = {
  title: 'DPDP Compliance | Spinzy Academy',
  description: "How Spinzy Academy complies with India's Digital Personal Data Protection Act (DPDP 2023).",
};

export default function DpdpPage() {
  return (
    <ComingSoon
      title="DPDP Compliance"
      description="Our full Digital Personal Data Protection Act (2023) compliance documentation is being finalised by our legal team. It will be published here shortly. For questions, email hello@spinzyacademy.com."
    />
  );
}
