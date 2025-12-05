'use client';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';

type Challenge = {
  id: string;
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  rewardPoints: number;
  rewardBadge?: { id: string; name: string } | null;
};

export default function WeeklyChallenge() {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/challenges/active')
      .then((r) => r.json())
      .then((d) => setChallenge(d.challenge ?? null));
  }, []);

  const join = async () => {
    if (!challenge) return;
    setLoading(true);
    await fetch('/api/challenges/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: challenge.id }),
    });
    setJoined(true);
    setLoading(false);
  };

  const submitCompletion = async () => {
    if (!challenge) return;
    setLoading(true);
    await fetch('/api/challenges/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: challenge.id, score: 100 }),
    });
    setLoading(false);
    toast('✅ Challenge completed! Rewards applied.');
  };

  if (!challenge) return null;

  return (
    <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow">
      <h4 className="font-semibold text-indigo-700 dark:text-yellow-200 mb-2">{challenge.title}</h4>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{challenge.description}</p>
      <div className="flex gap-2">
        <button
          onClick={join}
          disabled={joined || loading}
          className="px-3 py-1 rounded bg-indigo-600 text-white"
        >
          {joined ? 'Joined' : 'Join'}
        </button>
        <button
          onClick={submitCompletion}
          disabled={loading}
          className="px-3 py-1 rounded bg-green-600 text-white"
        >
          Submit Completion
        </button>
        <div className="ml-auto text-sm text-gray-500 dark:text-gray-400">
          {challenge.rewardPoints} pts
        </div>
      </div>
    </div>
  );
}
