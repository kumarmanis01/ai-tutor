export type UploadResult = { ok: true; url: string } | { ok: false; error?: string };

/**
 * Upload an image file to the server.
 * Calls the `/api/upload-image` endpoint and returns a structured result.
 */
export async function uploadImage(file: File): Promise<UploadResult> {
  try {
    // Request a presigned PUT URL from the server
    const metaRes = await fetch('/api/s3-presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, contentType: file.type }),
    });
    if (!metaRes.ok) {
      const payload = await metaRes.json().catch(() => ({}));
      return { ok: false, error: payload?.error || `presign-failed:${metaRes.status}` };
    }
    const meta = await metaRes.json().catch(() => null);
    if (!meta || !meta.url) return { ok: false, error: 'no-presigned-url' };

    // PUT the file to S3 using the presigned URL
    const putRes = await fetch(meta.url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
    if (!putRes.ok) {
      return { ok: false, error: `s3-put-failed:${putRes.status}` };
    }

    // Return the public object URL (or object key if you prefer)
    return { ok: true, url: meta.objectUrl || meta.url };
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
