"use client";
import { useSession } from "next-auth/react";

export default function DebugSession() {
  const { data: session, status } = useSession();

  if (status === "loading") return <p>Loading...</p>;
  if (!session) return <p>Not signed in</p>;

  return (
    <div>
      <h2>Signed in as {session.user?.email}</h2>
      <pre>{JSON.stringify(session, null, 2)}</pre>
    </div>
  );
}
