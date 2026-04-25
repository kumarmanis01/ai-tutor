import { formatErrorForResponse } from '@/lib/errorResponse';

describe('formatErrorForResponse', () => {
  test('formats Error objects', () => {
    const err = new Error('boom');
    const out = formatErrorForResponse(err);
    expect(out.name).toBe('Error');
    expect(out.message).toBe('boom');
    expect(out.stack).toBeTruthy();
  });

  test('formats string or undefined errors', () => {
    expect(formatErrorForResponse('simple')).toEqual({
      name: 'Error',
      message: 'simple',
      stack: null,
    });
    expect(formatErrorForResponse(undefined)).toEqual({
      name: 'Error',
      message: 'Unknown error',
      stack: null,
    });
  });

  test('formats objects without message', () => {
    const obj = { foo: 'bar' };
    const out = formatErrorForResponse(obj as any);
    expect(out.name).toBe('Error');
    expect(out.message).toBe('[object Object]');
    expect(out.stack).toBeNull();
  });
});
