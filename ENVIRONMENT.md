# Spinzy Academy — Environment Variables & Integrations

This document lists all required environment variables and integration points for local and production setups.

## 1. Environment Variables

- `OPENAI_API_KEY` — OpenAI API access
- `DATABASE_URL` — Postgres connection string
- `REDIS_URL` — Redis for BullMQ
- `NEXTAUTH_SECRET` — NextAuth secret
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` — Payments
- ...add others as needed

## 2. Integration Setup

- OpenAI: Used in `lib/callLLM.ts`
- Redis: Used for BullMQ queues/workers
- Postgres: Used via Prisma ORM
- NextAuth: Auth in `app/api/auth/`
- Razorpay: Payments

## 3. Reference
- See `.env.example` for sample values
- See `ARCHITECTURE.md` for integration context
