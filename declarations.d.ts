declare module '*.json' {
  const value: string[];
  export default value;
}

declare module '@sentry/nextjs';

// Auto-declarations for third-party modules that may not ship TypeScript types
declare module 'resend';
declare module 'web-push';
