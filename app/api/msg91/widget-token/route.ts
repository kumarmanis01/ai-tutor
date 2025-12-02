import { NextResponse } from 'next/server';

/**
 * Simple widget token provider endpoint.
 *
 * Behavior:
 * - If `MSG91_WIDGET_TOKEN` is set in the environment, return it.
 * - Otherwise return a 501 with instructions for how to generate a real widget token
 *   using MSG91 control APIs. This avoids embedding secrets in client code.
 *
 * NOTE: For production you should implement proper server-side token generation
 * using MSG91 control APIs (server calls the MSG91 API with `MSG91_AUTH_KEY`).
 */
export async function GET() {
  const token = process.env.MSG91_WIDGET_TOKEN;
  if (token) {
    return NextResponse.json({ ok: true, token });
  }

  return NextResponse.json(
    {
      ok: false,
      error: 'no_widget_token',
      message:
        'No MSG91_WIDGET_TOKEN configured. Implement server-side widget token generation using your MSG91 control API and set MSG91_WIDGET_TOKEN in .env for local testing.',
    },
    { status: 501 }
  );
}
