import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

type TopicPageProps = {
  params: Promise<{ topicId: string }>;
};

export default async function TopicLessonPage({ params }: TopicPageProps) {
  const { topicId } = await params;
  redirect(`/session/${encodeURIComponent(topicId)}`);
}
