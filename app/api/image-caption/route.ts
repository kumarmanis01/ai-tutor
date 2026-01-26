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

    // Try provider-backed captioning using OpenAI when available.
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) return NextResponse.json({ caption: null });

    try {
      // Fetch image bytes
      const imgResp = await fetch(url);
      if (!imgResp.ok) return NextResponse.json({ caption: null });
      const arrayBuffer = await imgResp.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Upload file to OpenAI Files endpoint (best-effort)
      const formData = new FormData();
      const filename = `upload-${Date.now()}.jpg`;
      const blob = new Blob([buffer]);
      formData.append('file', blob, filename);
      formData.append('purpose', 'answers');

      const uploadRes = await fetch('https://api.openai.com/v1/files', {
        method: 'POST',
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: formData as any,
      });

      if (!uploadRes.ok) {
        logger.error('OpenAI file upload failed', { className: 'api.image-caption', methodName: 'POST', body: await uploadRes.text().catch(() => '') });
        return NextResponse.json({ caption: null });
      }

      const uploadJson = await uploadRes.json().catch(() => ({}));
      const fileId = uploadJson?.id || uploadJson?.file_id || uploadJson?.name;

      // Ask OpenAI to caption the uploaded image via Responses API (best-effort)
      const prompt = `Please provide a single short caption (one sentence) describing the image in plain language. Respond with only the caption.`;
      const responseRes = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({ model: 'gpt-4o-mini', input: `${prompt}\n\nImage file id: ${fileId}` }),
      });

      let caption: string | null = null;
      if (responseRes.ok) {
        const j = await responseRes.json().catch(() => null);
        // Try to extract text from Responses structure
        if (j) {
          // Responses may have output[0].content[0].text or similar
          const out = j?.output?.[0]?.content?.[0];
          if (out && typeof out === 'string') caption = out.trim();
          if (!caption && Array.isArray(j?.output)) {
            const textParts: string[] = [];
            for (const o of j.output) {
              if (o?.content) {
                for (const c of o.content) {
                  if (typeof c === 'string') textParts.push(c);
                  else if (typeof c?.text === 'string') textParts.push(c.text);
                }
              }
            }
            if (textParts.length) caption = textParts.join(' ').trim();
          }
        }
      } else {
        logger.error('OpenAI responses call failed', { className: 'api.image-caption', methodName: 'POST', body: await responseRes.text().catch(() => '') });
      }

      // Attempt to delete uploaded file from OpenAI to limit retention (best-effort)
      try {
        if (fileId) {
          await fetch(`https://api.openai.com/v1/files/${fileId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
          }).catch(() => null);
        }
      } catch {
        // ignore
      }

      return NextResponse.json({ caption: caption ?? null });
    } catch (e) {
      logger.error('OpenAI captioning failed', { className: 'api.image-caption', methodName: 'POST', error: e });
      return NextResponse.json({ caption: null });
    }
  } catch (e) {
    logger.error('/api/image-caption error', { className: 'api.image-caption', methodName: 'POST', error: e });
    return NextResponse.json({ caption: null }, { status: 500 });
  }
}
