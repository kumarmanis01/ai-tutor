/**
 * FILE OBJECTIVE:
 * - Unit tests for session API action helpers, focused on TEST submission payload wiring.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/session/sessionActions.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-09T00:00:00Z | copilot | add tests to verify submitTestAction sends testId and surfaces API errors
 */

import { submitTestAction } from '@/lib/session/sessionActions';

type FetchResponse = {
  ok: boolean;
  json: () => Promise<unknown>;
};

describe('sessionActions.submitTestAction', () => {
  const fetchMock = jest.fn<Promise<FetchResponse>, [RequestInfo | URL, RequestInit | undefined]>();

  beforeEach(() => {
    fetchMock.mockReset();
    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      writable: true,
      configurable: true,
    });
  });

  it('should include testId in submit payload when provided', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        score: 1,
        percentage: 100,
        correctAnswers: 2,
        totalAnswers: 2,
        results: [],
      }),
    });

    await submitTestAction(
      'session-1',
      [
        { questionId: 'q1', answer: 'a' },
        { questionId: 'q2', answer: 'b' },
      ],
      'test-123',
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/session/session-1/test/submit');
    expect(init?.method).toBe('POST');

    const parsedBody = JSON.parse(String(init?.body)) as {
      answers: { questionId: string; answer: string }[];
      testId?: string;
    };

    expect(parsedBody.answers).toEqual([
      { questionId: 'q1', answer: 'a' },
      { questionId: 'q2', answer: 'b' },
    ]);
    expect(parsedBody.testId).toBe('test-123');
  });

  it('should throw with server error message when submit fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'bad submit' }),
    });

    await expect(
      submitTestAction('session-1', [{ questionId: 'q1', answer: 'a' }], 'test-123'),
    ).rejects.toThrow('bad submit');
  });
});
