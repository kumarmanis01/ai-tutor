import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const VALID_ISSUE_TYPES = ['incorrect_info', 'typo', 'unclear_explanation', 'missing_content', 'other'] as const;
type IssueType = typeof VALID_ISSUE_TYPES[number];

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

  logger.info({
    event: 'content_issue_reported',
    context: {
      topicId,
      issueType,
      studentId: session.user.id,
      descriptionLength: description.trim().length,
    },
  });

  return NextResponse.json({ success: true });
}
