/**
 * FILE OBJECTIVE:
 * - Validate S0.1/S0.2 registration payload schema parsing and channel-specific parent contact rules.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/student/registrationSchema.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T12:00:00Z | copilot | add schema tests for required subjects and parent contact validation
 */

import { studentRegistrationSchema } from '@/lib/student/registrationSchema';

describe('studentRegistrationSchema', () => {
  it('accepts adult payload without parent contact', () => {
    const result = studentRegistrationSchema.safeParse({
      name: 'Aarav',
      dateOfBirth: '2000-05-10',
      grade: 10,
      board: 'CBSE',
      medium: 'en',
      subjects: ['Mathematics', 'Science'],
    });

    expect(result.success).toBe(true);
  });

  it('rejects payload with missing subjects', () => {
    const result = studentRegistrationSchema.safeParse({
      name: 'Aarav',
      dateOfBirth: '2009-05-10',
      grade: 8,
      board: 'CBSE',
      medium: 'en',
      subjects: [],
      channel: 'whatsapp',
      parent_contact: '+919876543210',
    });

    expect(result.success).toBe(false);
  });

  it('rejects whatsapp parent contact when number is not 10 digits (after optional 91 prefix)', () => {
    const result = studentRegistrationSchema.safeParse({
      name: 'Aarav',
      dateOfBirth: '2012-05-10',
      grade: 6,
      board: 'CBSE',
      medium: 'en',
      subjects: ['Mathematics'],
      channel: 'whatsapp',
      parent_contact: '+91 98765',
    });

    expect(result.success).toBe(false);
  });

  it('accepts whatsapp parent contact with +91 prefix and spacing', () => {
    const result = studentRegistrationSchema.safeParse({
      name: 'Aarav',
      dateOfBirth: '2012-05-10',
      grade: 6,
      board: 'CBSE',
      medium: 'en',
      subjects: ['Mathematics'],
      channel: 'whatsapp',
      parent_contact: '+91 987 654 3210',
    });

    expect(result.success).toBe(true);
  });
});
