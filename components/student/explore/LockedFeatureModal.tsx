'use client';

/**
 * Reusable modal shown when a student taps a locked topic or feature in Explore Mode (S0.3).
 * Props drive the headline copy so the modal doubles for locked topics and locked features.
 */

interface Props {
  title: string;
  body: string;
  onSendReminder?: () => void;
  onViewSamples?: () => void;
  onClose: () => void;
  reminderBusy?: boolean;
}

export default function LockedFeatureModal({
  title,
  body,
  onSendReminder,
  onViewSamples,
  onClose,
  reminderBusy = false,
}: Props) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl" aria-hidden>
            🔒
          </span>
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">{title}</h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">{body}</p>
        <div className="flex flex-col gap-3">
          {onSendReminder && (
            <button
              type="button"
              disabled={reminderBusy}
              onClick={onSendReminder}
              className="flex w-full min-h-[44px] items-center justify-center rounded-xl bg-[#534AB7] text-white text-sm font-semibold hover:bg-[#4840a3] disabled:opacity-50 transition-colors"
            >
              {reminderBusy ? 'Sending...' : 'Send Reminder to Mom'}
            </button>
          )}
          {onViewSamples && (
            <button
              type="button"
              onClick={onViewSamples}
              className="flex w-full min-h-[44px] items-center justify-center rounded-xl border-2 border-[#534AB7] text-[#534AB7] dark:text-indigo-300 text-sm font-semibold hover:bg-[#EEEDFE] dark:hover:bg-[#534AB7]/10 transition-colors"
            >
              View Sample Lessons
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex w-full min-h-[44px] items-center justify-center rounded-xl border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-400 text-sm hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
