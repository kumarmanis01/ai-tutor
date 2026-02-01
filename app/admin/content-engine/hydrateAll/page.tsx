/**
 * FILE: Admin HydrateAll Page
 *
 * OBJECTIVE:
 * Main admin interface for submitting and monitoring HydrateAll jobs.
 *
 * FEATURES:
 * - Submit new HydrateAll jobs with configuration options
 * - View real-time progress of running jobs
 * - Browse job history with filtering
 * - Cost estimation before submission
 */

'use client';

import { useState, useEffect } from 'react';
import TriggerForm from './components/TriggerForm';
import ProgressDashboard from './components/ProgressDashboard';
import JobsTable from './components/JobsTable';

export default function HydrateAllPage() {
  const [activeTab, setActiveTab] = useState<'submit' | 'monitor' | 'history'>('submit');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">HydrateAll Content Generator</h1>
        <p className="mt-2 text-gray-600">
          Generate complete educational content (chapters, topics, notes, questions) for any
          subject.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('submit')}
            className={`
              whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm
              ${
                activeTab === 'submit'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            Submit New Job
          </button>
          <button
            onClick={() => setActiveTab('monitor')}
            className={`
              whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm
              ${
                activeTab === 'monitor'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            Monitor Progress
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`
              whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm
              ${
                activeTab === 'history'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            Job History
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow">
        {activeTab === 'submit' && (
          <div className="p-6">
            <TriggerForm
              onJobCreated={(jobId) => {
                setSelectedJobId(jobId);
                setActiveTab('monitor');
              }}
            />
          </div>
        )}

        {activeTab === 'monitor' && (
          <div className="p-6">
            <MonitorTab selectedJobId={selectedJobId} onSelectJob={setSelectedJobId} />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="p-6">
            <JobsTable
              onSelectJob={(jobId) => {
                setSelectedJobId(jobId);
                setActiveTab('monitor');
              }}
            />
          </div>
        )}
      </div>

      {/* Quick Stats Footer */}
      <QuickStats />
    </div>
  );
}

/**
 * Monitor tab: shows a job picker + progress dashboard for the selected job
 */
function MonitorTab({
  selectedJobId,
  onSelectJob,
}: {
  selectedJobId: string | null;
  onSelectJob: (id: string) => void;
}) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/hydrateAll')
      .then((r) => r.json())
      .then((data) => {
        const list = data.jobs || [];
        setJobs(list);
        // Auto-select the most recent running job, or the most recent job
        if (!selectedJobId && list.length > 0) {
          const running = list.find((j: any) => j.status === 'running');
          onSelectJob(running ? running.id : list[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading jobs...</div>;
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No jobs found. Submit a new job first.
      </div>
    );
  }

  return (
    <div>
      {/* Job Selector */}
      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Select Job:</label>
        <select
          value={selectedJobId || ''}
          onChange={(e) => onSelectJob(e.target.value)}
          className="flex-1 max-w-md rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-2 px-3 border"
        >
          {jobs.map((j: any) => (
            <option key={j.id} value={j.id}>
              {j.metadata.subject} Gr.{j.metadata.grade} ({j.metadata.board}) — {j.status} — {j.progress.overall}% — {j.id.slice(0, 10)}...
            </option>
          ))}
        </select>
      </div>

      {/* Progress Dashboard */}
      {selectedJobId && <ProgressDashboard jobId={selectedJobId} />}
    </div>
  );
}

/**
 * Quick statistics component
 */
function QuickStats() {
  const [stats, setStats] = useState({
    totalJobs: 0,
    runningJobs: 0,
    completedToday: 0,
    totalCostToday: 0,
  });

  useEffect(() => {
    // Fetch stats from API
    fetch('/api/admin/hydrateAll/stats')
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.totalJobs === 'number') setStats(data);
      })
      .catch(() => { /* stats fetch is best-effort; failures are silently ignored */ });
  }, []);

  return (
    <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard title="Total Jobs" value={stats.totalJobs} icon="📊" />
      <StatCard title="Running Now" value={stats.runningJobs} icon="⚙️" highlight />
      <StatCard title="Completed Today" value={stats.completedToday} icon="✅" />
      <StatCard title="Cost Today" value={`$${(stats.totalCostToday ?? 0).toFixed(2)}`} icon="💰" />
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  highlight = false,
}: {
  title: string;
  value: string | number;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`
        overflow-hidden rounded-lg px-4 py-5 shadow
        ${highlight ? 'bg-blue-50 border-2 border-blue-200' : 'bg-white'}
      `}
    >
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <span className="text-3xl">{icon}</span>
        </div>
        <div className="ml-5 w-0 flex-1">
          <dl>
            <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
            <dd
              className={`text-2xl font-semibold ${highlight ? 'text-blue-900' : 'text-gray-900'}`}
            >
              {value}
            </dd>
          </dl>
        </div>
      </div>
    </div>
  );
}
