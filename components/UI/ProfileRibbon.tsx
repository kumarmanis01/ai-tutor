'use client';
import Link from 'next/link';
import { useState } from 'react';

export default function ProfileRibbon({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(show);

  if (!visible) return null;

  return (
    <div className="fixed top-16 left-0 w-full z-40 flex justify-center pointer-events-none">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow px-4 py-1 rounded-b-lg flex items-center gap-2 pointer-events-auto min-h-[32px]">
        <span className="text-gray-800 dark:text-gray-100 text-sm font-medium">
          Please complete your Profile{' '}
          <Link href="/profile" className="underline text-blue-600 dark:text-blue-400">
            here
          </Link>
          .
        </span>
        <button
          className="ml-2 text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100 text-base font-bold"
          onClick={() => setVisible(false)}
          aria-label="Close"
        >
          ×
        </button>
      </div>
    </div>
  );
}
