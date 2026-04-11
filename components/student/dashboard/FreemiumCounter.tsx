/**
 * AC-02 (F-STU-040): Session cap counter -- always visible for free-tier students
 * who still have sessions remaining this month.
 *
 * Shows: "2 of 3 free sessions used this month" with reset date pill.
 * Only rendered when sessionsRemaining > 0 (UpgradeFlow takes over at 0).
 */

interface FreemiumCounterProps {
  sessionsUsed: number;
  sessionsRemaining: number;
  /** ISO string for start of current billing period */
  periodStart: string;
}

export function FreemiumCounter({ sessionsUsed, sessionsRemaining, periodStart }: FreemiumCounterProps) {
  const total = sessionsUsed + sessionsRemaining;

  const resetDate = new Date(periodStart);
  resetDate.setMonth(resetDate.getMonth() + 1);
  const resetLabel = resetDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });

  const fillPercent = total > 0 ? Math.round((sessionsUsed / total) * 100) : 0;

  // Colour band: green (0 used) -> amber (2/3) -> red (all used, but this
  // component is not rendered when all are used)
  const barColour =
    sessionsRemaining === 1 ? 'bg-[#BA7517]' : 'bg-[#534AB7]';

  return (
    <div
      className="mb-5 rounded-xl border border-[#534AB7]/20 bg-[#EEEDFE] dark:bg-[#534AB7]/10 px-4 py-3"
      role="status"
      aria-label={`${sessionsUsed} of ${total} free sessions used this month`}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-[#534AB7] dark:text-indigo-300 uppercase tracking-wide">
          Free sessions this month
        </p>
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          Resets {resetLabel}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="h-2 w-full rounded-full bg-[#534AB7]/15 dark:bg-[#534AB7]/25 overflow-hidden mb-2"
        aria-hidden="true"
      >
        <div
          className={`h-full rounded-full transition-all ${barColour}`}
          style={{ width: `${fillPercent}%` }}
        />
      </div>

      <p className="text-sm text-gray-700 dark:text-gray-300">
        <span className="font-bold text-gray-900 dark:text-gray-100">{sessionsUsed} of {total}</span>{' '}
        free sessions used this month
        {sessionsRemaining === 1 && (
          <span className="ml-2 inline-flex items-center rounded-full bg-[#FAEEDA] dark:bg-[#BA7517]/20 px-2 py-0.5 text-xs font-medium text-[#BA7517]">
            1 left
          </span>
        )}
      </p>
    </div>
  );
}

export default FreemiumCounter;
