# Spinzy Academy — Developer Workflows

This document describes key developer workflows for working with the Spinzy Academy codebase.

## 1. Local Development

- Install dependencies: `npm install`
- Start dev server: `npm run dev`
- Open [http://localhost:3000](http://localhost:3000)

## 2. Testing

- Run all tests: `npm test`
- E2E tests: `tests/e2e/`

## 3. Database Migrations

- Apply migrations: `npx prisma migrate dev`

## 4. Adding Features

- Add API: create folder in `app/api/feature/`, define `route.ts`
- Add component: add to `components/`, colocate styles/tests
- Use `lib/db.ts` for DB access

## 5. Content Generation/Approval

- All AI output is draft until admin approval
- Use admin UI to approve/rollback content
- No direct DB edits for content approval

## 6. Rollback & Regeneration

- Use admin UI for rollbacks
- Regeneration is batch-driven, resumable, and cost-tracked

## 7. Troubleshooting

- Check logs for errors
- See `copilot-instructions.md` for AI rules
- See `ARCHITECTURE.md` for system overview
