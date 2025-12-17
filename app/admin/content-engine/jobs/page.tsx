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
import { JobStatus } from '@/lib/ai-engine/types'

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function JobsIndexPage() {
    const { data, error, mutate } = useSWR('/api/admin/content-engine/jobs', fetcher);

    if (error) return <div className="p-4 text-red-600">Failed to load jobs.</div>;
    if (!data) return <div className="p-4">Loading...</div>;

    const handleAction = async (id: string, action: 'retry' | 'cancel') => {
        try {
            const res = await fetch(`/api/admin/content-engine/jobs/${id}/${action}`, { method: 'POST' });
            if (!res.ok) throw new Error('Action failed');
            alerts.success(`${action === 'retry' ? 'Retried' : 'Cancelled'} job successfully.`);
            mutate();
        } catch {
            alerts.error('Failed to perform action.');
        }
    };

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-4">Content Generation Jobs</h1>
            <div className="overflow-x-auto">
                <table className="min-w-full border text-sm">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="px-3 py-2 border">Job Type</th>
                            <th className="px-3 py-2 border">Entity</th>
                            <th className="px-3 py-2 border">Language</th>
                            <th className="px-3 py-2 border">Status</th>
                            <th className="px-3 py-2 border">Created At</th>
                            <th className="px-3 py-2 border">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.jobs?.length === 0 && (
                            <tr><td colSpan={6} className="text-center p-4">No jobs found.</td></tr>
                        )}
                        {data.jobs?.map((job: any) => (
                            <tr key={job.id} className="border-b">
                                <td className="px-3 py-2 border">{job.jobType}</td>
                                <td className="px-3 py-2 border">{job.entityType}{job.entityName ? `: ${job.entityName}` : ''}</td>
                                <td className="px-3 py-2 border">{job.language || '-'}</td>
                                <td className="px-3 py-2 border">{job.status}</td>
                                <td className="px-3 py-2 border">{new Date(job.createdAt).toLocaleString()}</td>
                                <td className="px-3 py-2 border space-x-2">
                                    {job.status === JobStatus.Failed && (
                                        <button
                                            className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700"
                                            onClick={() => handleAction(job.id, 'retry')}
                                        >
                                            Retry
                                        </button>
                                    )}
                                    {job.status === 'queued' && (
                                        <button
                                            className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700"
                                            onClick={() => handleAction(job.id, 'cancel')}
                                        >
                                            Cancel
                                        </button>
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
