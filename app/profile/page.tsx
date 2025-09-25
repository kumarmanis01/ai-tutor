"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function ProfilePage() {
  const { data: session } = useSession();
  const [subscription, setSubscription] = useState<{ isPremium: boolean; plan?: string }>({ isPremium: false });

  useEffect(() => {
    async function fetchStatus() {
      const res = await fetch("/api/subscription/status");
      const data = await res.json();
      setSubscription({ isPremium: data.isPremium, plan: data.plan });
    }
    if (session) fetchStatus();
  }, [session]);

  if (!session) {
    return <div className="p-6">You are not signed in.</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Profile</h1>
      <p>
        <strong>Name:</strong> {session.user?.name}
      </p>
      <p>
        <strong>Email:</strong> {session.user?.email}
      </p>
      {session.user?.image && (
        <img
          src={session.user.image}
          alt="avatar"
          className="w-20 h-20 rounded-full"
        />
      )}
      <p>
        <strong>Subscription:</strong>{" "}
        {subscription.isPremium
          ? `Premium (${subscription.plan || "pro"})`
          : "Free"}
      </p>
    </div>
  );
}
