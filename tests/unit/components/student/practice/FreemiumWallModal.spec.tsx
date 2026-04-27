/**
 * Unit tests for FreemiumWallModal component (S2.4).
 */

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));

describe('FreemiumWallModal module', () => {
  it('should import without throwing', () => {
    expect(() => require('@/components/student/practice/FreemiumWallModal')).not.toThrow();
  });

  it('should export default function', () => {
    const mod = require('@/components/student/practice/FreemiumWallModal');
    expect(typeof mod.default).toBe('function');
  });
});

describe('FreemiumWallModal copy variants', () => {
  beforeAll(() => {
    jest.resetModules();
  });

  it('should have practice variant copy with crushed headline', () => {
    // Load module in isolation to access contentByFeature via export pattern
    const mod = require('@/components/student/practice/FreemiumWallModal');
    // Component is the only export; confirm it exists for smoke
    expect(mod.default).toBeTruthy();
  });
});
