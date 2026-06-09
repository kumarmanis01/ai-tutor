/**
 * FILE OBJECTIVE:
 * - JSX tests for ConceptCard: render states, Deep Dive expand/collapse streaming
 *   toggle, hasLoaded cache guard, skeleton, difficulty reset behaviour.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | initial tests for Deep Dive per-concept card (task S3-1)
 */

/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock react-markdown (ESM-only package -- needs __esModule flag for default import to resolve)
jest.mock('react-markdown', () => {
  const MockMarkdown = ({ children }: { children: string }) =>
    React.createElement('div', { 'data-testid': 'markdown-content' }, children);
  MockMarkdown.displayName = 'ReactMarkdown';
  return { __esModule: true, default: MockMarkdown };
});

const mockStream = jest.fn();
const mockAbort = jest.fn();

jest.mock('@/hooks/useStream', () => ({
  useStream: () => ({ stream: mockStream, abort: mockAbort }),
}));

import { ConceptCard } from '@/components/session/ConceptCard';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_CONCEPT = {
  id: 'c1',
  title: 'Photosynthesis',
  summary: 'The process by which plants make food using sunlight.',
};

const BASE_PROPS = {
  concept: BASE_CONCEPT,
  topicSlug: 'plant-life',
  subject: 'biology',
  grade: '8',
  board: 'CBSE',
  difficulty: 5,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

type StreamCallbacks = {
  onToken: (t: string) => void;
  onDone: () => void;
  onError: (msg: string) => void;
};

/** Render and click Deep Dive, returning captured stream callbacks. */
function renderAndStartDeepDive() {
  let capturedCallbacks: StreamCallbacks | undefined;
  (mockStream as jest.Mock).mockImplementation(
    (_url: string, _body: object, callbacks: StreamCallbacks) => {
      capturedCallbacks = callbacks;
      return Promise.resolve();
    },
  );

  render(<ConceptCard {...BASE_PROPS} />);
  const button = screen.getByRole('button', { name: '→ Deep Dive' });
  fireEvent.click(button);

  if (!capturedCallbacks) throw new Error('stream was not called');
  return capturedCallbacks;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ConceptCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStream.mockResolvedValue(undefined);
    mockAbort.mockImplementation(() => {});
  });

  it('should render concept title and summary', () => {
    render(<ConceptCard {...BASE_PROPS} />);
    expect(screen.getByText('Photosynthesis')).toBeInTheDocument();
    expect(
      screen.getByText('The process by which plants make food using sunlight.'),
    ).toBeInTheDocument();
  });

  it('should show Deep Dive button', () => {
    render(<ConceptCard {...BASE_PROPS} />);
    expect(screen.getByRole('button', { name: '→ Deep Dive' })).toBeInTheDocument();
  });

  it('should expand and stream on first Deep Dive tap', async () => {
    const callbacks = renderAndStartDeepDive();

    // Button should be disabled while streaming
    expect(screen.getByRole('button', { name: 'Loading...' })).toBeDisabled();

    // Simulate tokens arriving
    act(() => {
      callbacks.onToken('Hello ');
      callbacks.onToken('world');
    });

    expect(screen.getByTestId('markdown-content')).toHaveTextContent('Hello world');

    // Stream done
    act(() => {
      callbacks.onDone();
    });

    expect(screen.getByRole('button', { name: '↑ Close' })).toBeInTheDocument();
    expect(mockStream).toHaveBeenCalledTimes(1);
    expect(mockStream).toHaveBeenCalledWith(
      '/api/concept/deep-dive',
      expect.objectContaining({ conceptTitle: 'Photosynthesis', difficulty: 5 }),
      expect.any(Object),
    );
  });

  it('should collapse on second tap without re-fetching', async () => {
    const callbacks = renderAndStartDeepDive();

    act(() => {
      callbacks.onToken('Deep content');
      callbacks.onDone();
    });

    // Second tap: collapse
    const closeBtn = screen.getByRole('button', { name: '↑ Close' });
    fireEvent.click(closeBtn);

    expect(screen.getByRole('button', { name: '→ Deep Dive' })).toBeInTheDocument();
    expect(mockStream).toHaveBeenCalledTimes(1); // no new stream call
  });

  it('should re-expand showing cached content on third tap', async () => {
    const callbacks = renderAndStartDeepDive();

    act(() => {
      callbacks.onToken('Cached explanation');
      callbacks.onDone();
    });

    // Second tap: collapse
    fireEvent.click(screen.getByRole('button', { name: '↑ Close' }));

    // Third tap: re-expand
    fireEvent.click(screen.getByRole('button', { name: '→ Deep Dive' }));

    // Content still visible -- no new stream
    expect(screen.getByTestId('markdown-content')).toHaveTextContent('Cached explanation');
    expect(mockStream).toHaveBeenCalledTimes(1);
  });

  it('should not call API when hasLoaded and re-expanding', async () => {
    const callbacks = renderAndStartDeepDive();

    act(() => {
      callbacks.onToken('Content');
      callbacks.onDone();
    });

    // Collapse then re-expand
    fireEvent.click(screen.getByRole('button', { name: '↑ Close' }));
    fireEvent.click(screen.getByRole('button', { name: '→ Deep Dive' }));

    expect(mockStream).toHaveBeenCalledTimes(1);
  });

  it('should show skeleton while streaming and content is empty', () => {
    let capturedCallbacks: StreamCallbacks | undefined;
    (mockStream as jest.Mock).mockImplementation(
      (_url: string, _body: object, callbacks: StreamCallbacks) => {
        capturedCallbacks = callbacks;
        return Promise.resolve();
      },
    );

    render(<ConceptCard {...BASE_PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: '→ Deep Dive' }));

    // No tokens yet -- skeleton should be visible
    expect(screen.getByRole('status', { name: 'Loading deep dive' })).toBeInTheDocument();
    expect(screen.queryByTestId('markdown-content')).not.toBeInTheDocument();

    void capturedCallbacks;
  });

  it('should reset hasLoaded when difficulty prop changes', async () => {
    let capturedCallbacks: StreamCallbacks | undefined;
    (mockStream as jest.Mock).mockImplementation(
      (_url: string, _body: object, callbacks: StreamCallbacks) => {
        capturedCallbacks = callbacks;
        return Promise.resolve();
      },
    );

    const { rerender } = render(<ConceptCard {...BASE_PROPS} />);
    fireEvent.click(screen.getByRole('button', { name: '→ Deep Dive' }));

    act(() => {
      capturedCallbacks?.onToken('Loaded content');
      capturedCallbacks?.onDone();
    });

    // Verify loaded state -- Close button visible
    expect(screen.getByRole('button', { name: '↑ Close' })).toBeInTheDocument();

    // Change difficulty prop
    rerender(<ConceptCard {...BASE_PROPS} difficulty={8} />);

    // After difficulty change: should be back to initial collapsed state
    expect(screen.getByRole('button', { name: '→ Deep Dive' })).toBeInTheDocument();
    expect(screen.queryByTestId('markdown-content')).not.toBeInTheDocument();
  });
});
