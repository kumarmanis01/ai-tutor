"use client";
import { useSession } from "next-auth/react";
import useCurrentUser from '@/hooks/useCurrentUser';

export default function DebugSession() {
  const { data: session, status } = useSession();
  const { data: profile } = useCurrentUser();

  if (status === "loading") return <p>Loading...</p>;
  if (!session) return <p>Not signed in</p>;

  return (
    <div>
      <h2>Signed in as {profile?.email ?? session.user?.email}</h2>
      <pre>{JSON.stringify({ session, profile }, null, 2)}</pre>
    </div>
  );
}
