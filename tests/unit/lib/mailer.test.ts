/**
 * FILE OBJECTIVE:
 * - Unit tests for mailer operational alert helpers, including topic-ranker
 *   missing-concept coverage alerts and dedupe behavior.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/mailer.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-07T00:00:00Z | copilot | add tests for topic-ranker coverage alert email send and dedupe suppression
 * - 2026-05-09T00:00:00Z | copilot | replace hardcoded feedback email literal with centralized constant
 */

import {
  MAILER_NO_REPLY_EMAIL,
  MAILER_TOPIC_RANKER_ALERT_EMAIL,
} from '@/lib/email/functionalityEmails';

describe('sendTopicRankerCoverageAlertSafe', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.EMAIL_FROM = `Spinzy Academy <${MAILER_NO_REPLY_EMAIL}>`;
  });

  it('sends email to feedback inbox when dedupe key is accepted', async () => {
    const sendMock = jest.fn().mockResolvedValue({ data: { id: 'mail_1' }, error: null });
    const setMock = jest.fn().mockResolvedValue('OK');

    jest.doMock('resend', () => ({
      Resend: jest.fn().mockImplementation(() => ({
        emails: { send: sendMock },
      })),
    }));
    jest.doMock('@/lib/redis', () => ({
      getRedis: () => ({ set: setMock }),
    }));
    jest.doMock('@/lib/logger', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    }));

    const { sendTopicRankerCoverageAlertSafe } = await import('@/lib/mailer');

    await sendTopicRankerCoverageAlertSafe({
      studentId: 'student-1',
      frontierSize: 3,
      rankableFrontierSize: 1,
      filteredTopicIds: ['topic-a', 'topic-b'],
    });

    expect(setMock).toHaveBeenCalled();
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: [MAILER_TOPIC_RANKER_ALERT_EMAIL],
      }),
    );
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining('topic ranking skipped 2 non-startable topic(s)'),
      }),
    );
  });

  it('suppresses email when dedupe window blocks duplicate alert', async () => {
    const sendMock = jest.fn().mockResolvedValue({ data: { id: 'mail_2' }, error: null });
    const setMock = jest.fn().mockResolvedValue(null);

    jest.doMock('resend', () => ({
      Resend: jest.fn().mockImplementation(() => ({
        emails: { send: sendMock },
      })),
    }));
    jest.doMock('@/lib/redis', () => ({
      getRedis: () => ({ set: setMock }),
    }));
    jest.doMock('@/lib/logger', () => ({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    }));

    const { sendTopicRankerCoverageAlertSafe } = await import('@/lib/mailer');

    await sendTopicRankerCoverageAlertSafe({
      studentId: 'student-1',
      frontierSize: 3,
      rankableFrontierSize: 1,
      filteredTopicIds: ['topic-a'],
    });

    expect(setMock).toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });
});
