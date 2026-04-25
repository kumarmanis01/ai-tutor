/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AITutorChatPanel from '@/components/student/session/AITutorChatPanel';

describe('AITutorChatPanel - session style selector', () => {
  const originalFetch = (global as any).fetch;

  beforeEach(() => {
    // Mock fetch to handle session style POST and tutor turn stream
    (global as any).fetch = jest.fn((url: string, opts?: any) => {
      if (String(url).includes('/api/tutor/session/style')) {
        return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
      }
      if (String(url).includes('/api/tutor/turn')) {
        const stream = {
          getReader: () => ({
            read: async () => ({ done: true, value: undefined }),
          }),
        };
        return Promise.resolve({ ok: true, body: stream });
      }
      return Promise.resolve({ ok: false });
    });
  });

  afterEach(() => {
    (global as any).fetch = originalFetch;
    jest.resetAllMocks();
  });

  it('persists session style and triggers re-explain when Diagram selected', async () => {
    render(
      <AITutorChatPanel
        sessionId="sess-1"
        conceptName="Triangles"
        subjectName="math"
        initialStage="CORE_EXPLANATION"
        isAITutorEnabled={true}
        onSessionComplete={() => {}}
        onAiMessage={() => {}}
      />
    );

    const select = screen.getByLabelText(/Explanation style/i);
    fireEvent.change(select, { target: { value: 'diagram' } });

    await waitFor(() => {
      expect((global as any).fetch).toHaveBeenCalled();
      expect((global as any).fetch as jest.Mock).toHaveBeenCalledWith(
        '/api/tutor/session/style',
        expect.objectContaining({ method: 'POST' })
      );
      expect((global as any).fetch as jest.Mock).toHaveBeenCalledWith(
        '/api/tutor/turn',
        expect.objectContaining({ method: 'POST' })
      );
      // Ensure the tutor turn body contained the diagram sentinel
      const calls = ((global as any).fetch as jest.Mock).mock.calls;
      const turnCall = calls.find((c: any[]) => String(c[0]).includes('/api/tutor/turn'));
      expect(turnCall).toBeDefined();
      const body = JSON.parse(turnCall[1].body);
      expect(body.studentMessage).toContain('__EXPLAIN_DIAGRAM__');
    });
  });
});
