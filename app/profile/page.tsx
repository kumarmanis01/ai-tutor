'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Avatar from '@/components/UI/Avatar';

export default function ProfilePage() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<{
    grade: string;
    parentEmail: string;
    country: string;
    language: string;
    billingCycle?: string;
    plan?: string;
    role?: string;
    memberSince?: string | null;
  }>({
    grade: '',
    parentEmail: '',
    country: '',
    language: '',
    billingCycle: '',
    plan: '',
    role: '',
    memberSince: null,
  });

  useEffect(() => {
    async function fetchProfile() {
      const res = await fetch('/api/user/profile');
      if (res.ok) {
        const data = await res.json();
        setProfile({
          grade: data.grade || '',
          parentEmail: data.parentEmail || '',
          country: data.country || '',
          language: data.language || '',
          billingCycle: data.billingCycle || '',
          plan: data.plan || '',
          role: data.role || '',
          memberSince: data.memberSince || null,
        });
      }
    }
    if (session) fetchProfile();
  }, [session]);

  if (!session) {
    return <div className="p-6">You are not signed in.</div>;
  } else {
    console.log(profile);
  }

  const fallback =
    session.user?.name?.charAt(0).toUpperCase() ||
    session.user?.email?.charAt(0).toUpperCase() ||
    '?';

  return (
    <div className="max-w-lg mx-auto p-8 bg-white dark:bg-gray-900 rounded-xl shadow-md space-y-6 text-gray-900 dark:text-gray-100">
      <div className="flex flex-col items-center space-y-2">
        <Avatar
          src={session.user?.image || undefined}
          alt={session.user?.name || session.user?.email || 'User avatar'}
          size={80}
          fallback={fallback}
        />
        <h1 className="text-2xl font-bold">{session.user?.name}</h1>
        <p className="text-gray-500 dark:text-gray-400">{session.user?.email}</p>
      </div>
      <div className="space-y-3 border border-gray-300 dark:border-gray-700 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="font-semibold">Country:</span>
          <span>{profile.country || <span className="text-gray-400">Not set</span>}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-semibold">Grade:</span>
          <span>{profile.grade || <span className="text-gray-400">Not set</span>}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-semibold">Parent Email:</span>
          <span>{profile.parentEmail || <span className="text-gray-400">Not set</span>}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-semibold">Language:</span>
          <span>{profile.language || <span className="text-gray-400">Not set</span>}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-semibold">Plan:</span>
          <span>{profile.plan || <span className="text-gray-400">Not set</span>}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-semibold">Billing Cycle:</span>
          <span>{profile.billingCycle || <span className="text-gray-400">Not set</span>}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-semibold">Role:</span>
          <span>{profile.role || <span className="text-gray-400">Not set</span>}</span>
        </div>
      </div>
      <div className="text-center text-sm text-gray-500 dark:text-gray-400">
        Member since{' '}
        {profile.memberSince ? new Date(profile.memberSince).toLocaleDateString() : 'N/A'} <br />
      </div>
    </div>
  );
}
