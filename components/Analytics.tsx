'use client';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackEvent } from '@/lib/analyticsClient';

export default function Analytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = Object.fromEntries(searchParams?.entries?.() ?? []);
    // log to console when tracking page views
    console.log('[analytics] trackEvent called', { event: 'page_view', path: pathname, query });
    trackEvent('page_view', { path: pathname, query });
  }, [pathname, searchParams]);

  return null;
}
