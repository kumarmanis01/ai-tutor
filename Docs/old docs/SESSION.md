Session Utilities

This project centralizes server-side session access in `lib/session.ts`.

Guidelines

- Server-side handlers (API routes, server components): use `getServerSessionForHandlers()` from `lib/session.ts`.
  - This wraps `getServerSession(authOptions)` and avoids repeating `authOptions` imports across the codebase.
  - Example:
    ```ts
    import { getServerSessionForHandlers } from '@/lib/session';
    const session = await getServerSessionForHandlers();
    ```

- Client-side code (browser components): use `useSession()` from `next-auth/react` or the canonical `useCurrentUser()` hook which fetches `/api/user/profile`.
  - `useCurrentUser()` is preferred when you need the full DB-backed `User` object instead of the minimal `session.user`.

- Do not call `getServerSession()` directly from many files. If you find direct calls, prefer migrating them to `getServerSessionForHandlers()`.

Rationale

- Centralizing session access makes it easier to change auth configuration and to add shared behavior (logging, telemetry, subscription checks) in one place.
- Keeping client and server session handling clear reduces accidental use of heavy session payloads on the client and prevents duplication.
