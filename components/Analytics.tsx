'use client';
import { logger } from '@/lib/logger';
/**
 * Client-side analytics component
 *
 * Responsibilities:
 * - Track SPA navigations (page_view) and send to /api/analytics/track via lib/analyticsClient.
 * - Avoid duplicate events for the same path+query.
 * - Use dynamic-safe stable deps (searchParams.toString()).
 *
 * Implementation notes:
 * - This is a Client Component (useEffect + next/navigation hooks) so it must include "use client".
 * - The component is fire-and-forget: it won't block rendering and it swallows errors.
 * - Keep lib/analyticsClient free of server-only imports.
 */
import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackEvent } from '@/lib/analyticsClient';

export default function Analytics(): null {
  // path + search params (stable string form used in deps)
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const searchKey = searchParams?.toString() ?? '';

  // lastSentRef avoids sending the same event repeatedly (e.g. re-renders)
  const lastSentRef = useRef<string | null>(null);

  useEffect(() => {
    // Build a simple serializable representation of the query
    const query = Object.fromEntries(searchParams?.entries?.() ?? []);
    const identifier = `${pathname}?${searchKey}`;

    // If same path+query was already sent, skip
    if (lastSentRef.current === identifier) return;
    lastSentRef.current = identifier;

    // Dev-only debug logging
    if (process.env.NODE_ENV !== 'production') {
      logger.debug('[analytics] page_view', { className: 'Analytics', path: pathname, query });
    }

    // Fire-and-forget track call. Await so we can catch errors cleanly.
    (async () => {
      try {
        await trackEvent('page_view', { path: pathname, query });
      } catch (err) {
        // Swallow errors to avoid breaking the app

        logger.error('[analytics] trackEvent failed', { className: 'Analytics', error: String(err) });
      }
    })();
    // Depend on pathname and the stable searchKey string (not the SearchParams object)
  }, [pathname, searchKey, searchParams]);

  return null;
}
