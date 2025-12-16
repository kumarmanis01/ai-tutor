COPILOT RULE: REDIS & QUEUES

- Never create Redis, BullMQ, or Queue instances at module import scope
- All Redis and Queue creation must be inside a function (lazy-init)
- API routes may call getQueue() only when an admin triggers a job
- Workers may create persistent connections on startup
- No side effects during import (safe for build, SSR, tests)

If unsure, default to lazy-init factory pattern.
