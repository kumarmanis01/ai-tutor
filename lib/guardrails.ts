/**
 * Guardrails: Prevents misuse of Spinzy Academy.
 * - Blocks profanity
 * - Prevents off-topic "dark buddy" misuse
 */

export function checkProfanity(message: string): boolean {
  const banned = ['fuck', 'shit', 'bitch']; // Extendable list
  return banned.some((w) => message.toLowerCase().includes(w));
}

export function enforceStudyContext(message: string): string | null {
  const offTopic = ['suicide', 'violence', 'dating', 'dark', 'nsfw'];
  if (offTopic.some((w) => message.toLowerCase().includes(w))) {
    return "⚠️ Let's stay focused on learning the relevant subject.";
  }
  return null;
}
