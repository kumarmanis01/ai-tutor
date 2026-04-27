"use client";

/**
 * FILE OBJECTIVE:
 * - Professional rollbacks history page displaying content status changes and admin actions.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/admin/content-engine/rollbacks/page.test.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-22T08:25:00Z | copilot | Refactored UI with professional styling, action badges, and timeline view
 */

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(res => res.json());

// Action badge component
function ActionBadge({ action }: { action: string }) {
    const colors: Record<string, string> = {
        rollback: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
        reject: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
        rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
        archive: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
        archived: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
        approve: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        revert: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    };
    const actionLower = action.toLowerCase();
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[actionLower] || 'bg-blue-100 text-blue-800'}`}>
            {action.charAt(0).toUpperCase() + action.slice(1)}
        </span>
    );
}

// Entity type badge
function EntityBadge({ entityType }: { entityType: string }) {
    const colors: Record<string, string> = {
        note: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
        test: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
        syllabus: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
        content: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
    };
    const typeLower = entityType?.toLowerCase() || 'content';
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[typeLower] || 'bg-gray-100 text-gray-800'}`}>
            {entityType || 'Content'}
        </span>
    );
}

// Empty state component
function EmptyState() {
    return (
        <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
                </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No Rollbacks Yet</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Content rollback history will appear here.</p>
        </div>
    );
}

// Loading skeleton
function LoadingSkeleton() {
    return (
        <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg" />
            ))}
        </div>
    );
}

// Timeline item component
function TimelineItem({ log, isLast }: { log: RollbackLog; isLast: boolean }) {
    return (
        <div className="relative pl-8 pb-8">
            {/* Timeline line */}
            {!isLast && (
                <div className="absolute left-3 top-8 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
            )}
            
            {/* Timeline dot */}
            <div className="absolute left-0 top-1 w-6 h-6 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full" />
            </div>
            
            {/* Content card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                        <ActionBadge action={log.action} />
                        <EntityBadge entityType={log.entityType} />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(log.createdAt).toLocaleString()}
                    </span>
                </div>
                
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="text-gray-700 dark:text-gray-300">{log.adminEmail || log.adminId || 'System'}</span>
                    </div>
                    
                    {log.entityId && (
                        <div className="flex items-center gap-2 text-sm">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            <span className="text-gray-500 dark:text-gray-400 font-mono text-xs">{log.entityId.slice(0, 12)}...</span>
                        </div>
                    )}
                    
                    {log.comment && (
                        <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                            <p className="text-sm text-gray-600 dark:text-gray-400 italic">&ldquo;{log.comment}&rdquo;</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

interface RollbackLog {
    id: string;
    action: string;
    adminEmail?: string;
    adminId?: string;
    entityType: string;
    entityId?: string;
    comment?: string;
    createdAt: string;
}

export default function RollbacksIndexPage() {
    const { data, error, isLoading } = useSWR('/api/admin/content-engine/rollbacks', fetcher);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/25">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Content Rollbacks</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">History of content status changes and reversions</p>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                {data && !error && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Total Actions</p>
                                <p className="text-3xl font-bold text-gray-900 dark:text-white">{data.rollbacks?.length || 0}</p>
                            </div>
                            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                                <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </div>
                        </div>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
                        <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <h3 className="text-lg font-medium text-red-800 dark:text-red-300 mb-1">Failed to Load</h3>
                        <p className="text-sm text-red-600 dark:text-red-400">Unable to fetch rollback history. Please try again.</p>
                    </div>
                )}

                {/* Loading State */}
                {isLoading && <LoadingSkeleton />}

                {/* Timeline View */}
                {data && !error && !isLoading && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                        {data.rollbacks?.length === 0 ? (
                            <EmptyState />
                        ) : (
                            <div className="relative">
                                {data.rollbacks?.map((log: RollbackLog, index: number) => (
                                    <TimelineItem 
                                        key={log.id} 
                                        log={log} 
                                        isLast={index === data.rollbacks.length - 1} 
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
