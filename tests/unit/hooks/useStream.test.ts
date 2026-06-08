/**
 * Unit tests for hooks/useStream
 * Tests the streaming logic by calling the hook functions directly.
 */

// Helpers to build a fake SSE ReadableStream
function buildSseStream(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(line));
      }
      controller.close();
    },
  });
}

// Build a minimal hook instance by directly invoking internal logic.
// We test the stream() and abort() functions returned by the hook
// by constructing them against a mocked fetch.
import { useStream } from '../../../hooks/useStream';

// useStream uses useRef/useCallback which require a React context.
// We stub them to avoid needing jsdom for this pure-logic test.
jest.mock('react', () => {
  const original = jest.requireActual('react') as typeof import('react');
  return {
    ...original,
    useRef: (init: unknown) => ({ current: init }),
    useCallback: (fn: unknown) => fn,
  };
});

describe('useStream', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  function makeFetchMock(body: ReadableStream<Uint8Array>, status = 200): jest.Mock {
    return jest.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      body,
    } as unknown as Response);
  }

  test('should emit tokens as they arrive', async () => {
    const sseLines = [
      'data: {"token":"Hello"}\n\n',
      'data: {"token":" world"}\n\n',
      'data: [DONE]\n\n',
    ];
    global.fetch = makeFetchMock(buildSseStream(sseLines));

    const tokens: string[] = [];
    let doneCalled = false;

    const { stream } = useStream();
    await stream('/api/ask', { text: 'hi' }, {
      onToken: (t) => tokens.push(t),
      onDone: () => { doneCalled = true; },
      onError: jest.fn(),
    });

    expect(tokens).toEqual(['Hello', ' world']);
    expect(doneCalled).toBe(true);
  });

  test('should call onDone when stream ends', async () => {
    const sseLines = ['data: {"token":"foo"}\n\n', 'data: [DONE]\n\n'];
    global.fetch = makeFetchMock(buildSseStream(sseLines));

    const onDone = jest.fn();
    const { stream } = useStream();

    await stream('/api/ask', {}, {
      onToken: jest.fn(),
      onDone,
      onError: jest.fn(),
    });

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  test('should call onError on upstream_error event', async () => {
    const sseLines = ['data: {"error":"upstream_error"}\n\n'];
    global.fetch = makeFetchMock(buildSseStream(sseLines));

    const onError = jest.fn();
    const { stream } = useStream();

    await stream('/api/ask', {}, {
      onToken: jest.fn(),
      onDone: jest.fn(),
      onError,
    });

    expect(onError).toHaveBeenCalledWith('upstream_error');
  });

  test('should abort fetch on abort() call', async () => {
    let abortFired = false;
    const neverResolvingFetch = jest.fn().mockImplementation((_url: string, opts: RequestInit) => {
      return new Promise<never>((_resolve, reject) => {
        opts.signal?.addEventListener('abort', () => {
          abortFired = true;
          reject(new DOMException('AbortError', 'AbortError'));
        });
      });
    });
    global.fetch = neverResolvingFetch as unknown as typeof global.fetch;

    const onError = jest.fn();
    const onDone = jest.fn();
    const { stream, abort } = useStream();

    // Start stream (fire and forget -- will be aborted)
    const streamPromise = stream('/api/ask', {}, {
      onToken: jest.fn(),
      onDone,
      onError,
    });

    // Abort synchronously -- the abort handler fires on next microtask
    abort();

    // Let microtasks run
    await Promise.resolve();
    await streamPromise.catch(() => {});

    expect(abortFired).toBe(true);
    // Abort is silent -- neither onDone nor onError should be called
    expect(onDone).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});
