# Spinzy Academy — Phase 2 (MVP)

## Quick start

1. Copy files into project (folder structure above)
2. Add `OPENAI_API_KEY` to `.env.local`
3. Install deps: `npm install`
4. Run locally: `npm run dev`
5. Open http://localhost:3000

## Notes

- Phase 2 provides multilingual chat (English/Hindi), speech (TTS + mic), accessibility, local storage.
- Server-side OpenAI key is required in `.env.local` as `OPENAI_API_KEY`.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Logging

Spinzy Academy uses a centralized logger (`lib/logger.ts`) across server and client.

- Server `LOG_LEVEL`: Controls server log verbosity. Allowed values: `error`, `warn`, `info`, `debug`. Default is `error`.
- Client `NEXT_PUBLIC_DEBUG_MODE`: When `true`, client emits `info`/`debug` logs; when `false`, client still emits `error` logs to ensure visibility.

Add these to your environment (recommended in `.env.local`):

```bash
# .env.local
LOG_LEVEL=warn
NEXT_PUBLIC_DEBUG_MODE=true
```

Use in code:

```ts
import { logger } from '@/lib/logger';

logger.error('Failed to fetch profile', { userId });
logger.warn('Fallback to default config');
logger.info('User onboarded', { step: 'profile-complete' });
logger.debug('Speech settings', { lang, micEnabled });
```

Notes:
- Avoid `console.*`; route all logs through `logger`.
- In production, prefer `LOG_LEVEL=error` and `NEXT_PUBLIC_DEBUG_MODE=false`.
