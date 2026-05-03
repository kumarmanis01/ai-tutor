import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';
import { sendMailSafe } from '@/lib/mailer';
import { EMAIL_CONTENT_REPORT } from '@/lib/constants/email';

export const dynamic = 'force-dynamic';

const VALID_ISSUE_TYPES = ['incorrect_info', 'typo', 'unclear_explanation', 'missing_content', 'other'] as const;
type IssueType = typeof VALID_ISSUE_TYPES[number];

const ISSUE_LABELS: Record<IssueType, string> = {
  incorrect_info: 'Incorrect information',
  typo: 'Typo or spelling error',
  unclear_explanation: 'Unclear explanation',
  missing_content: 'Missing content',
  other: 'Other',
};

interface Params {
  params: Promise<{ topicId: string }>;
}

export async function POST(req: Request, { params }: Params) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'Not authenticated' }, { status: 401 });
  }

  const { topicId } = await params;
  if (!topicId) {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'Missing topicId' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'Invalid JSON' }, { status: 400 });
  }

  const { issueType, description } = body as { issueType?: string; description?: string };

  if (!issueType || !VALID_ISSUE_TYPES.includes(issueType as IssueType)) {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'Invalid issue type' }, { status: 400 });
  }
  if (typeof description !== 'string' || description.trim().length === 0) {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'Description is required' }, { status: 400 });
  }
  if (description.length > 1000) {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'Description too long' }, { status: 400 });
  }

  const validated = issueType as IssueType;

  logger.info({
    event: 'content_issue_reported',
    context: {
      topicId,
      issueType: validated,
      studentId: session.user.id,
      descriptionLength: description.trim().length,
    },
  });

  const emailSubject = `[Content Issue] ${ISSUE_LABELS[validated]} -- topic ${topicId}`;
  const emailHtml = `
    <h2>Content Issue Report</h2>
    <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
      <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Topic ID</td><td>${topicId}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Issue Type</td><td>${ISSUE_LABELS[validated]}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Student ID</td><td>${session.user.id}</td></tr>
    </table>
    <h3 style="margin-top:16px">Description</h3>
    <p style="white-space:pre-wrap;background:#f5f5f5;padding:12px;border-radius:6px">${description.trim()}</p>
  `;

  await sendMailSafe({ to: EMAIL_CONTENT_REPORT, subject: emailSubject, html: emailHtml });

  return NextResponse.json({ success: true });
}
