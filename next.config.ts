/**
 * FILE OBJECTIVE:
 * - Next.js configuration including Sentry integration for error tracking.
 *
 * LINKED UNIT TEST:
 * - tests/unit/next.config.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-XX | copilot | added Sentry configuration wrapper
 */

import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Force server-side rendering only, no static generation
  experimental: {
    esmExternals: false,
  },
  // Disable static optimization
  generateBuildId: async () => {
    return 'build-' + Date.now()
  },
  async rewrites() {
    return [
      { source: '/landing-page', destination: '/' },
    ];
  },
  async redirects() {
    return [
      {
        source: '/onboarding',
        destination: '/dashboard',
        permanent: false,
      },
    ];
  },
  images: {
    domains: [
      'lh3.googleusercontent.com',
      'i.pravatar.cc',
      'flagcdn.com',
      'ai-tutor-uploads-spinzyacademy-01.s3.eu-north-1.amazonaws.com',
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
      },
      {
        protocol: 'https',
        hostname: 'flagcdn.com',
      },
      {
        protocol: 'https',
        hostname: 'ai-tutor-uploads-spinzyacademy-01.s3.eu-north-1.amazonaws.com',
      },
    ],
  },
};

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // Organization and project from Sentry dashboard
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Auth token for uploading source maps
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Silently fail if Sentry is not configured (dev mode)
  silent: !process.env.SENTRY_AUTH_TOKEN,

  // Upload source maps for better stack traces
  widenClientFileUpload: true,

  // Hide source maps from clients
  hideSourceMaps: true,

  // Disable logger in production
  disableLogger: true,

  // Tree-shake Sentry code in production for smaller bundles
  tunnelRoute: '/monitoring',
};

// Only wrap with Sentry in production or when explicitly enabled
const shouldUseSentry = process.env.NODE_ENV === 'production' || process.env.ENABLE_SENTRY === '1';

export default shouldUseSentry
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;
