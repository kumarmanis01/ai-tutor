/**
 * Simple session-based context memory for AI
 * - Stores last N messages in local/session storage
 * - Can be extended to Redis/DB for persistence
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
