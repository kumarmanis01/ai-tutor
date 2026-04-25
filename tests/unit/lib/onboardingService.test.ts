/**
 * Unit tests for HttpOnboardingService.saveProfile
 */

import { HttpOnboardingService } from '@/lib/onboardingService';

describe('HttpOnboardingService.saveProfile', () => {
  const svc = new HttpOnboardingService();

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('sends school_name in POST body when provided', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    (global as any).fetch = mockFetch;

    const values = {
      name: 'Alice',
      age: 14,
      class_grade: '9',
      board: 'cbse',
      preferred_language: 'en',
      subjects: ['mathematics'],
      school_name: 'St Aloysius',
    };

    await expect(svc.saveProfile(values as any)).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const call = mockFetch.mock.calls[0];
    expect(call[0]).toBe('/api/user/onboarding');
    const opts = call[1];
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body);
    expect(body.school_name).toBe('St Aloysius');
  });

  it('throws mapped fieldErrors when server returns validation_error', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValue({
        ok: false,
        json: async () => ({
          error: 'validation_error',
          fieldErrors: { school_name: 'too long' },
          message: 'Invalid',
        }),
      });
    (global as any).fetch = mockFetch;

    const values = {
      name: 'Bob',
      age: 12,
      class_grade: '7',
      board: 'state',
      preferred_language: 'en',
      subjects: ['english'],
      school_name: 'X'.repeat(200),
    };

    await expect(svc.saveProfile(values as any)).rejects.toMatchObject({
      fieldErrors: { school_name: 'too long' },
    });
  });
});
