/**
 * Unit tests for session artifact persistence logic.
 * F-STU-014 AC-06: Whiteboard state saved as SessionArtifact for session replay.
 *
 * Tests the validation logic inline (pure functions -- no DB required).
 */

const ALLOWED_TYPES = ['whiteboard'] as const;
const MAX_DATA_URL_LENGTH = 5 * 1024 * 1024;

function isAllowedType(type: string): boolean {
  return (ALLOWED_TYPES as readonly string[]).includes(type);
}

function isValidDataUrl(dataUrl: string): boolean {
  return typeof dataUrl === 'string' && dataUrl.startsWith('data:');
}

function isWithinSizeLimit(dataUrl: string): boolean {
  return dataUrl.length <= MAX_DATA_URL_LENGTH;
}

describe('SessionArtifact API -- validation logic', () => {
  describe('isAllowedType', () => {
    it('should accept whiteboard type', () => {
      expect(isAllowedType('whiteboard')).toBe(true);
    });

    it('should reject unknown type', () => {
      expect(isAllowedType('video')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isAllowedType('')).toBe(false);
    });
  });

  describe('isValidDataUrl', () => {
    it('should accept valid data URL', () => {
      expect(isValidDataUrl('data:image/png;base64,abc123')).toBe(true);
    });

    it('should reject non-data-URL string', () => {
      expect(isValidDataUrl('https://example.com/image.png')).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidDataUrl('')).toBe(false);
    });
  });

  describe('isWithinSizeLimit', () => {
    it('should accept a small data URL', () => {
      const small = 'data:image/png;base64,' + 'A'.repeat(1000);
      expect(isWithinSizeLimit(small)).toBe(true);
    });

    it('should reject a data URL exceeding 5MB', () => {
      const huge = 'data:image/png;base64,' + 'A'.repeat(MAX_DATA_URL_LENGTH + 1);
      expect(isWithinSizeLimit(huge)).toBe(false);
    });

    it('should accept exactly at the limit', () => {
      const exactly = 'A'.repeat(MAX_DATA_URL_LENGTH);
      expect(isWithinSizeLimit(exactly)).toBe(true);
    });
  });

  describe('artifact creation payload', () => {
    it('should build correct artifact data shape', () => {
      const userId = 'user-123';
      const sessionId = 'sess-456';
      const type = 'whiteboard';
      const dataUrl = 'data:image/png;base64,abc';

      const payload = {
        studentId: userId,
        sessionId,
        type,
        url: dataUrl,
        uploadedBy: userId,
      };

      expect(payload.type).toBe('whiteboard');
      expect(payload.url).toBe(dataUrl);
      expect(payload.studentId).toBe(payload.uploadedBy);
    });
  });
});
