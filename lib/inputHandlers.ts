export type UploadResult = { ok: true; url: string } | { ok: false; error?: string };

/**
 * Upload an image file to the server.
 * Calls the `/api/upload-image` endpoint and returns a structured result.
 */
export async function uploadImage(file: File): Promise<UploadResult> {
  try {
    const form = new FormData();
    form.append('file', file);

    const res = await fetch('/api/upload-image', { method: 'POST', body: form });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      return { ok: false, error: payload?.error || `upload-failed:${res.status}` };
    }

    const data = await res.json().catch(() => null);
    if (data && typeof data.url === 'string') {
      return { ok: true, url: data.url };
    }

    return { ok: false, error: 'no-url-returned' };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Send a text question to the server for processing (stub).
 * Replace the fetch URL and payload with the real backend route.
 */
export async function sendTextQuestion(text: string): Promise<{ ok: boolean; reply?: string; error?: string }> {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      return { ok: false, error: payload?.error || `status-${res.status}` };
    }
    const json = await res.json().catch(() => ({}));
    return { ok: true, reply: json?.reply };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Start voice input / recognition flow (stub).
 * Implement platform-specific recorder or Web Speech API usage.
 */
import { createSpeechController } from './speech';

/**
 * Start voice input via the shared speech controller.
 * Returns a stop function (cleanup) or null if not supported.
 */
export function startVoiceInput(
  onInterim: (text: string) => void,
  onFinal: (text: string, lang?: string) => void,
  onError?: (msg: string) => void,
) {
  const controller = createSpeechController({
    onInterim,
    onFinal,
    onError,
  });
  if (!controller) return null;
  controller.start();
  return () => controller.stop();
}
