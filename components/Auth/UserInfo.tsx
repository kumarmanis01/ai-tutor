'use client';
import { useSession } from 'next-auth/react';
import LogoutButton from './LogoutButton';
import Image from 'next/image';
import useCurrentUser from '@/hooks/useCurrentUser';

export default function UserInfo() {
  const { data: session } = useSession();
  const { data: profile } = useCurrentUser();

  // If there's no active session, don't render the info.
  if (!session?.user) return null;

  const src = profile?.image ?? session.user.image ?? '/default-avatar.png';
  const label = profile?.name ?? session.user.name ?? session.user.email;

  return (
    <div className="flex items-center gap-3">
      <Image
        src={src}
        alt="avatar"
        className="w-8 h-8 rounded-full"
        width={32}
        height={32}
        priority={false}
      />
      <div className="text-sm">{label}</div>
      <LogoutButton />
    </div>
  );
}
