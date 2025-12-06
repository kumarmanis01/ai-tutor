export type UploadResult = { ok: true; url: string } | { ok: false; error?: string; details?: string };

/**
 * Upload an image file to the server.
 * Calls the `/api/upload-image` endpoint and returns a structured result.
 */
import resizeImageFile from './resizeImage';
import { logger } from '@/lib/logger';

export async function uploadImage(file: File): Promise<UploadResult> {
  try {
    // Primary: produce a compressed WebP (best size) when possible
    let primaryFile: File = file;
    try {
      primaryFile = await resizeImageFile(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.80, mimeType: 'image/webp' });
    } catch (err) {
      logger.warn('Primary (webp) resize failed, falling back to original', { className: 'inputHandlers', methodName: 'uploadImage', details: String(err) });
      primaryFile = file;
    }

    // Request a presigned PUT URL for the primary image
    const primaryRes = await fetch('/api/s3-presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: primaryFile.name || file.name, contentType: primaryFile.type || file.type }),
    });
    if (!primaryRes.ok) {
      const payload = await primaryRes.json().catch(() => ({}));
      return { ok: false, error: payload?.error || `presign-failed:${primaryRes.status}`, details: payload?.message };
    }
    const primaryMeta = await primaryRes.json().catch(() => null);
    if (!primaryMeta || !primaryMeta.url) return { ok: false, error: 'no-presigned-url' };

    // Upload primary (WebP or original)
    const putPrimary = await fetch(primaryMeta.url, { method: 'PUT', headers: { 'Content-Type': primaryFile.type }, body: primaryFile });
    if (!putPrimary.ok) {
      return { ok: false, error: `s3-put-failed:${putPrimary.status}` };
    }

    // Prefer previewUrl for immediate browser display (private object), else objectUrl
    const primaryUrl = primaryMeta.previewUrl || primaryMeta.objectUrl || primaryMeta.url;

    // Background: upload a small JPEG fallback for compatibility (do not block)
    (async () => {
      try {
        const jpegFallback = await resizeImageFile(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.78, mimeType: 'image/jpeg' });
        // Request presign for fallback
        const fallbackRes = await fetch('/api/s3-presign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: jpegFallback.name || `${file.name.replace(/\.[^.]+$/, '')}.jpg`, contentType: jpegFallback.type }),
        });
        if (!fallbackRes.ok) return;
        const fallbackMeta = await fallbackRes.json().catch(() => null);
        if (!fallbackMeta || !fallbackMeta.url) return;
        await fetch(fallbackMeta.url, { method: 'PUT', headers: { 'Content-Type': jpegFallback.type }, body: jpegFallback });
      } catch (e) {
        // ignore background failures but log for debugging
        logger.warn(`JPEG fallback upload failed: ${String(e)}`, { className: 'inputHandlers', methodName: 'uploadImage' });
      }
    })();

    return { ok: true, url: primaryUrl };
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
  lang?: string,
) {
  const controller = createSpeechController({
    lang,
    onInterim,
    onFinal,
    onError,
  });
  if (!controller) return null;
  controller.start();
  return () => controller.stop();
}
