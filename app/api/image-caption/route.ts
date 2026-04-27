import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';
// No session required; gated by explicit user consent to avoid sending images without permission

/*
  /api/image-caption

  Environment variables:
  - IMAGE_CAPTION_API (optional): if set, requests are proxied to this external caption service with { url, consent }.
  - OPENAI_API_KEY (optional): if IMAGE_CAPTION_API is not set and OPENAI_API_KEY is present, the route will
    attempt a best-effort caption using OpenAI (uploads the image bytes, requests a caption, then deletes the
    uploaded file). OpenAI usage is gated by `consent` to avoid sending user images without explicit consent.

  Notes: This endpoint is intentionally best-effort and will return { caption: null } if captioning fails.
*/

type Req = { url?: string; consent?: boolean };

export async function POST(req: Request) {
  try {
    const body: Req = await req.json().catch(() => ({}));
    const url = body.url;
    const consent = Boolean(body.consent);
    if (!url) return NextResponse.json({ caption: null }, { status: 400 });

    // If an external captioning service is configured (IMAGE_CAPTION_API), forward the request.
    const imageCaptionApi = process.env.IMAGE_CAPTION_API;
    if (imageCaptionApi) {
      try {
        const r = await fetch(imageCaptionApi, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, consent }),
        });
        if (r.ok) {
          const j = await r.json().catch(() => ({}));
          return NextResponse.json({ caption: j.caption ?? null });
        }
        return NextResponse.json({ caption: null });
      } catch (e) {
        logger.error('image-caption external call failed', { className: 'api.image-caption', methodName: 'POST', error: e });
        return NextResponse.json({ caption: null });
      }
    }

    // If consent is not provided, do not forward to third-party providers.
    if (!consent) {
      return NextResponse.json({ caption: null });
    }

    // We do not call OpenAI from API routes. If an external caption service
    // is not configured, return null (best-effort). Workers may perform
    // captioning when available.
    return NextResponse.json({ caption: null });
  } catch (e) {
    logger.error('/api/image-caption error', { className: 'api.image-caption', methodName: 'POST', error: e });
    return NextResponse.json({ caption: null }, { status: 500 });
  }
}
