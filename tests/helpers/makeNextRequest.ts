/**
 * Test helper: construct a NextRequest for route handler tests.
 *
 * Routes that read query params via req.nextUrl.searchParams require a
 * NextRequest (Next.js-specific), not a plain fetch Request. Using a plain
 * Request causes nextUrl to be undefined at runtime, surfacing as a 500
 * instead of the expected 400/403.
 *
 * Usage:
 *   import { makeNextRequest } from '../../helpers/makeNextRequest';
 *
 *   const req = makeNextRequest('http://localhost?studentId=abc');
 *   const req = makeNextRequest('http://localhost', { method: 'POST', body: { foo: 1 } });
 */
import { NextRequest } from 'next/server';

interface MakeNextRequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

export function makeNextRequest(url: string, options: MakeNextRequestOptions = {}): NextRequest {
  const { method = 'GET', body, headers = {} } = options;
  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    if (!headers['Content-Type'] && !headers['content-type']) {
      (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
    }
  }
  return new NextRequest(url, init);
}
