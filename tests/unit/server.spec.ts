/**
 * FILE OBJECTIVE:
 * - Unit tests for server.ts web bootstrap behavior.
 *
 * LINKED UNIT TEST:
 * - This IS the unit test file.
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created tests for web server Socket.IO bootstrap
 */

jest.mock('next', () => jest.fn());
jest.mock('@/lib/socket/server', () => ({ initSocketIO: jest.fn() }));

import http from 'http';
import next from 'next';
import { initSocketIO } from '@/lib/socket/server';
import { startWebServer } from '@/server';

const mockNext = next as unknown as jest.Mock;
const mockInitSocketIO = initSocketIO as jest.MockedFunction<typeof initSocketIO>;

describe('startWebServer', () => {
  const originalCreateServer = http.createServer;

  afterEach(() => {
    jest.clearAllMocks();
    http.createServer = originalCreateServer;
  });

  it('should prepare next app, create server, and initialize Socket.IO', async () => {
    const prepare = jest.fn().mockResolvedValue(undefined);
    const handle = jest.fn();
    mockNext.mockReturnValue({
      prepare,
      getRequestHandler: () => handle,
    });

    const listen = jest.fn((_: number, __: string, cb: () => void) => cb());
    const once = jest.fn().mockReturnThis();
    const fakeServer = { listen, once } as unknown as http.Server;

    http.createServer = jest.fn().mockReturnValue(fakeServer) as unknown as typeof http.createServer;

    const server = await startWebServer();

    expect(server).toBe(fakeServer);
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(http.createServer).toHaveBeenCalledTimes(1);
    expect(mockInitSocketIO).toHaveBeenCalledWith(fakeServer);
    expect(listen).toHaveBeenCalled();
  });
});
