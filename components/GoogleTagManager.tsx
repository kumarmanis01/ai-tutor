/**
 * FILE OBJECTIVE:
 * - Google Tag Manager integration for external analytics, conversion tracking, and marketing pixels.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/GoogleTagManager.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-XX | copilot | created GTM integration component
 */

'use client';

import Script from 'next/script';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { logger } from '@/lib/logger';

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;
const CLASS_NAME = 'GoogleTagManager';

/**
 * Declare global dataLayer for TypeScript
 */
declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
    gtag: (...args: unknown[]) => void;
  }
}

/**
 * Push events to GTM dataLayer
 */
export function pushToDataLayer(event: string, data?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event,
    ...data,
  });
}

/**
 * Track page view with GTM
 */
export function trackPageView(url: string): void {
  pushToDataLayer('page_view', {
    page_path: url,
    page_title: typeof document !== 'undefined' ? document.title : '',
  });
}

/**
 * Track user events (for conversion tracking)
 */
export function trackGTMEvent(
  eventName: string,
  eventParams?: Record<string, unknown>
): void {
  pushToDataLayer(eventName, eventParams);
}

/**
 * Track e-commerce events (for subscription conversions)
 */
export function trackPurchase(params: {
  transactionId: string;
  value: number;
  currency?: string;
  items?: Array<{
    id: string;
    name: string;
    price: number;
    quantity?: number;
  }>;
}): void {
  pushToDataLayer('purchase', {
    transaction_id: params.transactionId,
    value: params.value,
    currency: params.currency || 'INR',
    items: params.items || [],
  });
}

/**
 * Track signup event (for conversion optimization)
 */
export function trackSignup(method: string): void {
  pushToDataLayer('sign_up', {
    method,
  });
}

/**
 * Track subscription start (for funnel tracking)
 */
export function trackSubscriptionStart(plan: string, value: number): void {
  pushToDataLayer('begin_checkout', {
    currency: 'INR',
    value,
    items: [{ id: plan, name: `${plan} Plan`, price: value }],
  });
}

/**
 * Google Tag Manager head script component
 * Place this in the <head> of your document
 */
export function GoogleTagManagerHead(): JSX.Element | null {
  if (!GTM_ID) return null;

  return (
    <Script
      id="gtm-script"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','${GTM_ID}');
        `,
      }}
    />
  );
}

/**
 * Google Tag Manager noscript fallback
 * Place this immediately after opening <body> tag
 */
export function GoogleTagManagerNoScript(): JSX.Element | null {
  if (!GTM_ID) return null;

  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height="0"
        width="0"
        style={{ display: 'none', visibility: 'hidden' }}
        title="Google Tag Manager"
      />
    </noscript>
  );
}

/**
 * Main GTM component that handles automatic page tracking
 * Include this once in your app layout
 */
export default function GoogleTagManager(): JSX.Element | null {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Track page views on navigation
  useEffect(() => {
    if (!GTM_ID) return;
    
    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
    trackPageView(url);
  }, [pathname, searchParams]);

  if (!GTM_ID) {
    // GTM not configured - log in development
    if (process.env.NODE_ENV === 'development') {
      logger.debug('NEXT_PUBLIC_GTM_ID not set - GTM disabled', { className: CLASS_NAME });
    }
    return null;
  }

  return (
    <>
      <GoogleTagManagerHead />
      <GoogleTagManagerNoScript />
    </>
  );
}
