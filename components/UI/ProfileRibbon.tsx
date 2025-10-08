'use client';
import Link from 'next/link';
import { useState } from 'react';

export default function ProfileRibbon({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(show);

  if (!visible) return null;

  return (
    <div className="fixed top-16 left-0 w-full z-40 flex justify-center pointer-events-none">
      <div className="bg-white border border-gray-200 shadow px-6 py-3 rounded-b-lg flex items-center gap-3 pointer-events-auto">
        <span className="text-gray-800 font-medium">
          Please complete your Profile{' '}
          <Link href="/profile" className="underline text-blue-600">
            here
          </Link>
          .
        </span>
        <button
          className="ml-2 text-gray-500 hover:text-gray-700 text-lg font-bold"
          onClick={() => setVisible(false)}
          aria-label="Close"
        >
          ×
        </button>
      </div>
    </div>
  );
}
