/**
 * Simple session-based context memory for AI (client-only helpers)
 * - Stores last N messages in local/session storage
 * - Can be extended to Redis/DB for persistence
 * 
 */
const MAX_CONTEXT = 10;

export function getContext(): { role: string; content: string }[] {
  if (typeof window === "undefined") return [];
  return JSON.parse(localStorage.getItem("chatContext") || "[]");
}

export function saveMessage(role: string, content: string) {
  const ctx = getContext();
  ctx.push({ role, content });
  if (ctx.length > MAX_CONTEXT) ctx.shift();
  localStorage.setItem("chatContext", JSON.stringify(ctx));
  return ctx;
}

/**
 * createAIClient
 *
 * Lightweight server-safe stub used by test generation hooks. In production,
 * replace the implementation to call your LLM provider (e.g., OpenAI) and
 * return a JSON-serializable structure with a `text` field.
 */
export function createAIClient() {
  return {
    /**
     * Minimal completion call. The default stub returns an empty JSON array
     * to indicate no generated questions, so callers can fall back to bank
     * selection without failing builds in dev.
     */
    async complete({ prompt }: { prompt: string; maxTokens?: number }) {
      try {
        // Intentionally no external calls in stub. Log in dev for visibility.
        if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.debug('[createAIClient.stub] complete called with prompt length:', prompt?.length ?? 0);
        }
      } catch {}
      return { text: '[]' } as { text: string };
    },
  };
}
