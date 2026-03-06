/**
 * FILE OBJECTIVE:
 * - Practice page with 4 simplified sections:
 *   1. Recommended Practice (from TopicRanker)
 *   2. Weak Topics Practice (mastery < 0.4)
 *   3. Chapter Practice (subject → chapter)
 *   4. Custom Test (advanced filters)
 *
 * EDIT LOG:
 * - 2026-03-06 | claude | simplified to topic-first layout
 */
import PracticeTab from '@/app/(student)/dashboard/components/Practice';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Practice – Spinzy Academy' };

export default function PracticePage() {
  return <PracticeTab />;
}
