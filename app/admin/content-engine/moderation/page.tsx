"use client";
/**
 * AI CONTENT ENGINE NOTICE:
 * - Job-based execution only
 * - No per-job pause/resume
 * - No streaming or progress tracking
 * - All AI calls are atomic and retryable
 * - Content requires admin approval
 */

import useSWR from 'swr';
import { alerts } from '@/lib/alerts';

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function ModerationIndexPage() {
    const { data, error, mutate } = useSWR('/api/admin/content-engine/moderation', fetcher);

    if (error) return <div className="p-4 text-red-600">Failed to load moderation queue.</div>;
    if (!data) return <div className="p-4">Loading...</div>;

    const handleAction = async (id: string, action: 'approve' | 'reject') => {
        try {
            const res = await fetch(`/api/admin/content-engine/moderation/${id}/${action}`, { method: 'POST' });
            if (!res.ok) throw new Error('Action failed');
            alerts.success(`${action === 'approve' ? 'Approved' : 'Rejected'} content successfully.`);
            mutate();
        } catch {
            alerts.error('Failed to perform action.');
        }
    };

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Content Moderation</h1>
            <div className="overflow-x-auto">
                <table className="min-w-full border text-sm">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="px-3 py-2 border">Content ID</th>
                            <th className="px-3 py-2 border">Type</th>
                            <th className="px-3 py-2 border">Status</th>
                            <th className="px-3 py-2 border">Language</th>
                            <th className="px-3 py-2 border">Created At</th>
                            <th className="px-3 py-2 border">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.contents?.length === 0 && (
                            <tr><td colSpan={6} className="text-center p-4">No content pending moderation.</td></tr>
                        )}
                        {data.contents?.map((item: any) => (
                            <tr key={item.id} className="border-b">
                                <td className="px-3 py-2 border">{item.id}</td>
                                <td className="px-3 py-2 border">{item.type}</td>
                                <td className="px-3 py-2 border">{item.status}</td>
                                <td className="px-3 py-2 border">{item.language || '-'}</td>
                                <td className="px-3 py-2 border">{new Date(item.createdAt).toLocaleString()}</td>
                                <td className="px-3 py-2 border space-x-2">
                                    {item.status === 'pending' && (
                                        <>
                                            <button
                                                className="px-3 py-1 rounded bg-green-600 text-white text-xs hover:bg-green-700 transition"
                                                onClick={() => handleAction(item.id, 'approve')}
                                                type="button"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                className="px-3 py-1 rounded bg-red-600 text-white text-xs hover:bg-red-700 transition"
                                                onClick={() => handleAction(item.id, 'reject')}
                                                type="button"
                                            >
                                                Reject
                                            </button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
