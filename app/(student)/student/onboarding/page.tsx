/**
 * Student onboarding — complete profile (name, grade, board, subjects).
 * Reached via layout redirect when checkProfileCompleteness returns complete: false.
 * Query: ?missing=name,grade,board,subjects
 */
export default function StudentOnboardingPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Complete your profile</h1>
      <p className="mt-2 text-gray-600">
        Please fill in your name, grade, board, and subjects to continue.
      </p>
    </div>
  );
}
