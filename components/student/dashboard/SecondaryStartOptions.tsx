'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SecondaryStartOptions({
  _todaysConceptId,
}: {
  _todaysConceptId?: string | null;
}) {
  const _router = useRouter();
  const [_loading, _setLoading] = useState(false);

  // async function handleSurprise() {
  //   if (loading) return;
  //   setLoading(true);
  //   try {
  //     const res = await fetch('/api/student/surprise-me');
  //     if (res.status === 401) {
  //       toast('Please sign in to use Surprise me');
  //       setLoading(false);
  //       return;
  //     }
  //     if (res.status === 204) {
  //       toast('No suggestions available right now. Try browsing topics.');
  //       setLoading(false);
  //       return;
  //     }
  //     const json = await res.json();
  //     if (!res.ok) throw new Error(json?.error || 'Failed to get suggestion');
  //     const action = json?.action;
  //     if (!action || !action.topicId) {
  //       toast('No suggestion returned');
  //       setLoading(false);
  //       return;
  //     }
  //     // Navigate to the pre-session screen for the suggested topic
  //     router.push(`/session/pre/${encodeURIComponent(action.topicId)}`);
  //   } catch (err: any) {
  //     toast(String(err?.message || 'Could not pick a surprise topic'));
  //   } finally {
  //     setLoading(false);
  //   }
  // }

  return (
    <div className="mt-3 flex items-center gap-3">
      {/* <Link
        href={
          todaysConceptId ? `/session/pre/${encodeURIComponent(todaysConceptId)}` : '/dashboard'
        }
        className="inline-flex items-center justify-center px-4 py-2 min-h-[44px] rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Today's topic
      </Link> */}

      {/* <Link
        href="/student/learning-map"
        className="inline-flex items-center justify-center px-4 py-2 min-h-[44px] rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Browse topics
      </Link> */}

      {/* <button
        type="button"
        onClick={handleSurprise}
        disabled={loading}
        className="inline-flex items-center justify-center px-4 py-2 min-h-[44px] rounded-xl bg-[#534AB7] text-white text-sm font-medium hover:bg-[#4840a3] disabled:opacity-60"
      >
        {loading ? 'Picking...' : 'Surprise me'}
      </button> */}
    </div>
  );
}
