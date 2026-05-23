import logger from "./logger";

/**
 * Simple session-based context memory for AI (client-only helpers)
 * - Stores last N messages in local/session storage
 * - Can be extended to Redis/DB for persistence
 * 
 */
const MAX_CONTEXT = 10;

const isBrowser = typeof globalThis !== "undefined" && typeof (globalThis as Record<string, unknown>)["localStorage"] !== "undefined";
type StorageLike = { getItem(key: string): string | null; setItem(key: string, value: string): void };
const storage: StorageLike | null = isBrowser
  ? (globalThis as unknown as { localStorage: StorageLike }).localStorage
  : null;

export function getContext(): { role: string; content: string }[] {
  if (!storage) return [];
  return JSON.parse(storage.getItem("chatContext") || "[]");
}

export function saveMessage(role: string, content: string) {
  const ctx = getContext();
  ctx.push({ role, content });
  if (ctx.length > MAX_CONTEXT) ctx.shift();
  storage?.setItem("chatContext", JSON.stringify(ctx));
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
          logger.debug('[createAIClient.stub] complete called with prompt length:', { promptLength: prompt?.length ?? 0 })
        }
      } catch {}
      return { text: '[]' } as { text: string };
    },
  };
}
