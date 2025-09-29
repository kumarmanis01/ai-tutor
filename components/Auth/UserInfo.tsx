// components/Auth/UserInfo.tsx
"use client";
import { useSession } from "next-auth/react";
import LogoutButton from "./LogoutButton";

export default function UserInfo() {
  const { data: session } = useSession();
  if (!session?.user) return null;
  return (
    <div className="flex items-center gap-3">
      <img
        src={session.user.image ?? "/default-avatar.png"}
        alt="avatar"
        className="w-8 h-8 rounded-full"
      />
      <div className="text-sm">{session.user.name ?? session.user.email}</div>
      <LogoutButton />
    </div>
  );
}
