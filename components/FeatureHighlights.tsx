import React from 'react';

export default function FeatureHighlights() {
  return (
    <section className="max-w-4xl mx-auto my-1 p-6 bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 rounded-lg shadow-sm">
      <h2 className="text-4xl md:text-5xl font-bold mb-4">Why AI Tutor</h2>

      <ul className="grid gap-3 sm:grid-cols-2">
        <li className="flex items-start space-x-3">
          <span className="text-2xl">✅</span>
          <div>
            <div className="text-xl font-bold">Personalized learning</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Tailored lessons and practice to your pace.
            </div>
          </div>
        </li>

        <li className="flex items-start space-x-3">
          <span className="text-2xl">⚡</span>
          <div>
            <div className="text-xl font-bold">Instant help</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Get explanations, examples, and step-by-step solutions.
            </div>
          </div>
        </li>

        <li className="flex items-start space-x-0">
          <span className="text-2xl">🏆</span>
          <div>
            <div className="text-xl font-bold">Badges &amp; Leaderboards</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Earn badges and compare progress with peers.
            </div>
          </div>
        </li>

        <li className="flex items-start space-x-3">
          <span className="text-2xl">📈</span>
          <div>
            <div className="text-xl font-bold">Progress Tracking</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Track learning streaks, points, and improvements over time.
            </div>
          </div>
        </li>
        <li className="flex items-start space-x-3">
          <span className="text-2xl">👪</span>
          <div>
            <div className="font-medium">Parental Dashboard</div>
            <div className="text-sm text-gray-500">
              Parents can monitor student progress (Pro/Enterprise).
            </div>
          </div>
        </li>

        <li className="flex items-start space-x-3">
          <span className="text-2xl">🏫</span>
          <div>
            <div className="font-medium">Teacher Access</div>
            <div className="text-sm text-gray-500">
              Teachers can create group study rooms and manage classrooms (Enterprise).
            </div>
          </div>
        </li>
      </ul>

      <div className="mt-6 border-t pt-4 text-medium text-gray-600 dark:text-gray-300 space-y-2">
        <p className="font-medium">Safe for students. No ads. No distractions.</p>
        <p>Your questions and data are private and secure.</p>
      </div>
    </section>
  );
}
