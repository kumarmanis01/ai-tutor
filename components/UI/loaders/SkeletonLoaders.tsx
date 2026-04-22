function SkeletonBlock({ className }: { className: string }) {
  return <div className={`loader-shimmer rounded ${className}`} aria-hidden="true" />;
}

export function LessonSkeleton() {
  return (
    <div
      className="w-full max-w-2xl mx-auto p-4 space-y-4"
      role="status"
      aria-label="Loading lesson"
    >
      <SkeletonBlock className="h-6 w-3/4" />
      <SkeletonBlock className="h-2 w-full" />
      <SkeletonBlock className="h-8 w-1/2" />
      <div className="space-y-3">
        <SkeletonBlock className="h-24 w-full rounded-lg" />
        <SkeletonBlock className="h-24 w-full rounded-lg" />
        <SkeletonBlock className="h-16 w-full rounded-lg" />
      </div>
      <SkeletonBlock className="h-11 w-full rounded-xl mt-6" />
      <span className="sr-only">Loading lesson content...</span>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div
      className="w-full p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-3"
      role="status"
      aria-label="Loading card"
    >
      <SkeletonBlock className="h-5 w-2/3" />
      <SkeletonBlock className="h-4 w-full" />
      <SkeletonBlock className="h-4 w-5/6" />
      <SkeletonBlock className="h-4 w-4/5" />
      <span className="sr-only">Loading card content...</span>
    </div>
  );
}

export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <ul
      className="w-full space-y-2"
      role="status"
      aria-label="Loading list"
    >
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 p-3 rounded-lg">
          <SkeletonBlock className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonBlock className="h-4 w-3/4" />
            <SkeletonBlock className="h-3 w-1/2" />
          </div>
        </li>
      ))}
      <li className="sr-only">Loading list...</li>
    </ul>
  );
}

export function QuestionSkeleton() {
  return (
    <div
      className="w-full max-w-2xl mx-auto p-4 space-y-6"
      role="status"
      aria-label="Loading question"
    >
      <div className="space-y-2">
        <SkeletonBlock className="h-5 w-full" />
        <SkeletonBlock className="h-5 w-4/5" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800"
          >
            <SkeletonBlock className="h-5 w-5 rounded-full flex-shrink-0" />
            <SkeletonBlock className="h-4 flex-1" />
          </div>
        ))}
      </div>
      <SkeletonBlock className="h-11 w-full rounded-xl" />
      <span className="sr-only">Loading question...</span>
    </div>
  );
}
