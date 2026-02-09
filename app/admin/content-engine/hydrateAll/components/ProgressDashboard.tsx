/**
 * FILE: Progress Dashboard Component
 *
 * OBJECTIVE:
 * Real-time progress monitoring for HydrateAll jobs.
 *
 * FEATURES:
 * - Live progress bars for each content level
 * - Status badges with color coding
 * - Cost tracking (estimated vs actual)
 * - Execution timeline with logs
 * - Auto-refresh every 5 seconds
 */

'use client';

import { useState, useEffect } from 'react';

interface ProgressDashboardProps {
  jobId: string;
}

interface JobProgress {
  jobId: string;
  rootJobId: string | null;
  status: string;
  progress: {
    overall: number;
    levels: {
      chapters: { completed: number; expected: number };
      topics: { completed: number; expected: number };
      notes: { completed: number; expected: number };
      questions: { completed: number; expected: number };
    };
  };
  timing: {
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    estimatedDurationMins: number | null;
    actualDurationMins: number | null;
  };
  cost: {
    estimated: number | null;
    actual: number | null;
  };
  metadata: {
    language: string;
    board: string;
    grade: number;
    subject: string;
    traceId: string | null;
  };
  recentLogs: Array<{
    id: string;
    event: string;
    message: string | null;
    createdAt: string;
  }>;
  childJobSummary?: Record<string, Record<string, number>>;
  failedJobs?: Array<{
    id: string;
    jobType: string;
    lastError: string | null;
    createdAt: string;
  }>;
}

export default function ProgressDashboard({ jobId }: ProgressDashboardProps) {
  const [jobProgress, setJobProgress] = useState<JobProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchProgress = async () => {
    try {
      const response = await fetch(`/api/admin/hydrateAll/${jobId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch job progress');
      }
      const data = await response.json();
      setJobProgress(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  // Auto-refresh every 5 seconds if job is running
  useEffect(() => {
    if (!autoRefresh || !jobProgress) return;

    if (jobProgress.status === 'pending' || jobProgress.status === 'running') {
      const interval = setInterval(fetchProgress, 5000);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, jobProgress]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <h3 className="text-sm font-medium text-red-800">Error</h3>
        <p className="mt-2 text-sm text-red-700">{error}</p>
        <button
          onClick={fetchProgress}
          className="mt-3 text-sm font-medium text-red-600 hover:text-red-500"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!jobProgress) {
    return <div className="text-center py-12 text-gray-500">No job data available</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header with Status */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {jobProgress.metadata.subject} - Grade {jobProgress.metadata.grade}
          </h2>
          <p className="text-sm text-gray-500">
            {jobProgress.metadata.board} | {jobProgress.metadata.language.toUpperCase()} | Job ID:{' '}
            {jobId.slice(0, 8)}...
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <StatusBadge status={jobProgress.status} />
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1 text-sm rounded-md ${
              autoRefresh ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {autoRefresh ? '🔄 Auto-refresh ON' : '⏸️ Auto-refresh OFF'}
          </button>
        </div>
      </div>

      {/* Overall Progress */}
      <div className="bg-white border rounded-lg p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">Overall Progress</h3>
          <span className="text-2xl font-bold text-blue-600">{jobProgress.progress.overall}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4">
          <div
            className="bg-blue-600 h-4 rounded-full transition-all duration-500"
            style={{ width: `${jobProgress.progress.overall}%` }}
          ></div>
        </div>
      </div>

      {/* Level Progress */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <LevelProgressCard
          title="Chapters"
          icon="📚"
          completed={jobProgress.progress.levels.chapters.completed}
          expected={jobProgress.progress.levels.chapters.expected}
          color="blue"
        />
        <LevelProgressCard
          title="Topics"
          icon="📝"
          completed={jobProgress.progress.levels.topics.completed}
          expected={jobProgress.progress.levels.topics.expected}
          color="green"
        />
        <LevelProgressCard
          title="Notes"
          icon="📄"
          completed={jobProgress.progress.levels.notes.completed}
          expected={jobProgress.progress.levels.notes.expected}
          color="yellow"
        />
        <LevelProgressCard
          title="Questions"
          icon="❓"
          completed={jobProgress.progress.levels.questions.completed}
          expected={jobProgress.progress.levels.questions.expected}
          color="purple"
        />
      </div>

      {/* Timing & Cost */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Timing */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">⏱️ Timing</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Created:</dt>
              <dd className="text-gray-900">{formatDateTime(jobProgress.timing.createdAt)}</dd>
            </div>
            {jobProgress.timing.startedAt && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Started:</dt>
                <dd className="text-gray-900">{formatDateTime(jobProgress.timing.startedAt)}</dd>
              </div>
            )}
            {jobProgress.timing.finishedAt && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Finished:</dt>
                <dd className="text-gray-900">{formatDateTime(jobProgress.timing.finishedAt)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t pt-2">
              <dt className="text-gray-500">Estimated Duration:</dt>
              <dd className="text-gray-900">
                {jobProgress.timing.estimatedDurationMins || 0} mins
              </dd>
            </div>
            {jobProgress.timing.actualDurationMins && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Actual Duration:</dt>
                <dd className="font-semibold text-gray-900">
                  {jobProgress.timing.actualDurationMins} mins
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Cost */}
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">💰 Cost Tracking</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Estimated Cost:</dt>
              <dd className="text-gray-900">${jobProgress.cost.estimated?.toFixed(2) || '0.00'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Actual Cost:</dt>
              <dd className="font-semibold text-gray-900">
                ${jobProgress.cost.actual?.toFixed(2) || '0.00'}
              </dd>
            </div>
            {jobProgress.cost.estimated && jobProgress.cost.actual && (
              <div className="flex justify-between border-t pt-2">
                <dt className="text-gray-500">Variance:</dt>
                <dd
                  className={`font-semibold ${
                    jobProgress.cost.actual > jobProgress.cost.estimated
                      ? 'text-red-600'
                      : 'text-green-600'
                  }`}
                >
                  {(
                    ((jobProgress.cost.actual - jobProgress.cost.estimated) /
                      jobProgress.cost.estimated) *
                    100
                  ).toFixed(1)}
                  %
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Execution Logs */}
      <div className="bg-white border rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">📋 Recent Logs</h3>
        {jobProgress.recentLogs.length === 0 ? (
          <p className="text-sm text-gray-500">No logs yet</p>
        ) : (
          <div className="space-y-2">
            {jobProgress.recentLogs.map((log) => (
              <div key={log.id} className="flex items-start space-x-3 text-sm border-b pb-2">
                <EventBadge event={log.event} />
                <div className="flex-1">
                  <p className="text-gray-900">{log.message || log.event}</p>
                  <p className="text-xs text-gray-500">{formatDateTime(log.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Child Jobs Summary */}
      {jobProgress.childJobSummary && Object.keys(jobProgress.childJobSummary).length > 0 && (
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Child Jobs</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.entries(jobProgress.childJobSummary).map(([jobType, statuses]) => {
              const total = Object.values(statuses).reduce((a, b) => a + b, 0);
              return (
                <div key={jobType} className="border rounded-md p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900 capitalize">{jobType}</span>
                    <span className="text-xs text-gray-500">{total} total</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(statuses).map(([status, count]) => (
                      <span key={status} className="text-xs">
                        <StatusBadge status={status} size="sm" /> {count}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Failed Jobs with Retry */}
      {jobProgress.failedJobs && jobProgress.failedJobs.length > 0 && (
        <FailedJobsPanel
          failedJobs={jobProgress.failedJobs}
          onRetrySuccess={fetchProgress}
        />
      )}
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

function StatusBadge({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' }) {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  const colorClasses =
    {
      pending: 'bg-gray-100 text-gray-800',
      running: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      cancelled: 'bg-yellow-100 text-yellow-800',
    }[status] || 'bg-gray-100 text-gray-800';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${sizeClasses} ${colorClasses}`}
    >
      {status.toUpperCase()}
    </span>
  );
}

function EventBadge({ event }: { event: string }) {
  const colorClasses =
    {
      CREATED: 'bg-blue-100 text-blue-800',
      START: 'bg-green-100 text-green-800',
      STEP: 'bg-yellow-100 text-yellow-800',
      COMPLETED: 'bg-green-100 text-green-800',
      ERROR: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-800',
    }[event] || 'bg-gray-100 text-gray-800';

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${colorClasses}`}
    >
      {event}
    </span>
  );
}

function LevelProgressCard({
  title,
  icon,
  completed,
  expected,
  color,
}: {
  title: string;
  icon: string;
  completed: number;
  expected: number;
  color: 'blue' | 'green' | 'yellow' | 'purple';
}) {
  const percentage = expected > 0 ? Math.round((completed / expected) * 100) : 0;

  const colorClasses = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    yellow: 'bg-yellow-600',
    purple: 'bg-purple-600',
  }[color];

  return (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">{icon}</span>
          <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        </div>
        <span className="text-sm font-bold text-gray-900">
          {completed} / {expected}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${colorClasses}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
      <p className="mt-1 text-xs text-gray-500">{percentage}% complete</p>
    </div>
  );
}

function FailedJobsPanel({
  failedJobs,
  onRetrySuccess,
}: {
  failedJobs: Array<{ id: string; jobType: string; lastError: string | null; createdAt: string }>;
  onRetrySuccess: () => void;
}) {
  const [retrying, setRetrying] = useState<Record<string, boolean>>({});
  const [retryingAll, setRetryingAll] = useState(false);

  const retryJob = async (jobId: string) => {
    setRetrying((prev) => ({ ...prev, [jobId]: true }));
    try {
      const res = await fetch(`/api/admin/hydrateAll/${jobId}/retry`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Retry failed');
      } else {
        onRetrySuccess();
      }
    } catch {
      alert('Network error');
    } finally {
      setRetrying((prev) => ({ ...prev, [jobId]: false }));
    }
  };

  const retryAll = async () => {
    setRetryingAll(true);
    for (const job of failedJobs) {
      await retryJob(job.id);
    }
    setRetryingAll(false);
  };

  return (
    <div className="bg-white border border-red-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-red-700">
          Failed Jobs ({failedJobs.length})
        </h3>
        <button
          onClick={retryAll}
          disabled={retryingAll}
          className="px-3 py-1 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
        >
          {retryingAll ? 'Retrying...' : 'Retry All Failed'}
        </button>
      </div>
      <div className="space-y-2">
        {failedJobs.map((job) => (
          <div key={job.id} className="flex items-start justify-between border rounded-md p-3 bg-red-50">
            <div className="flex-1 min-w-0 mr-3">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-900 capitalize">{job.jobType}</span>
                <span className="text-xs text-gray-400 font-mono">{job.id.slice(0, 10)}...</span>
              </div>
              {job.lastError && (
                <p className="mt-1 text-xs text-red-600 truncate" title={job.lastError}>
                  {job.lastError}
                </p>
              )}
            </div>
            <button
              onClick={() => retryJob(job.id)}
              disabled={retrying[job.id]}
              className="px-3 py-1 text-xs font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-100 disabled:opacity-50 shrink-0"
            >
              {retrying[job.id] ? 'Retrying...' : 'Retry'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDateTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}
