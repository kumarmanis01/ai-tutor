'use client';
import { useSession } from 'next-auth/react';
import LogoutButton from './LogoutButton';
import Image from 'next/image';

export default function UserInfo() {
  const { data: session } = useSession();
  if (!session?.user) return null;
  return (
    <div className="flex items-center gap-3">
      <Image
        src={session.user.image ?? '/default-avatar.png'}
        alt="avatar"
        className="w-8 h-8 rounded-full"
        width={32}
        height={32}
        priority={false}
      />
      <div className="text-sm">{session.user.name ?? session.user.email}</div>
      <LogoutButton />
    </div>
  );
}
