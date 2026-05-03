'use client';

import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';

export default function RoleSelector() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 px-4 py-12">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <Logo variant="auth" className="mb-4" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Who is joining today?
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Choose your role to get started with Spinzy
          </p>
        </div>

        <div className="space-y-4">
          <button
            type="button"
            onClick={() => router.push('/student/onboarding')}
            className="w-full min-h-[80px] rounded-2xl border-2 border-[#534AB7] bg-white dark:bg-slate-900 hover:bg-[#EEEDFE] dark:hover:bg-slate-800 transition-colors text-left px-5 py-4 group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#EEEDFE] flex items-center justify-center text-2xl shrink-0">
                🎒
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-gray-100 text-base group-hover:text-[#534AB7]">
                  {"I'm a Student"}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Practice, learn, and master concepts
                </p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => router.push('/parent-onboarding')}
            className="w-full min-h-[80px] rounded-2xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 hover:border-[#1D9E75] hover:bg-[#EAF3DE] dark:hover:bg-slate-800 transition-colors text-left px-5 py-4 group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#EAF3DE] flex items-center justify-center text-2xl shrink-0">
                👨‍👩‍👧
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-gray-100 text-base group-hover:text-[#1D9E75]">
                  {"I'm a Parent"}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Set up learning for your child
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
