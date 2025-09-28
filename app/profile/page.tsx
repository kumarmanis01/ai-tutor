"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Avatar from "@/components/UI/Avatar";

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

  // Compute fallback initials (first letter of name or email)
  const fallback =
    session.user?.name?.charAt(0).toUpperCase() ||
    session.user?.email?.charAt(0).toUpperCase() ||
    "?";

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Profile</h1>
      <div>
        <Avatar
          src={session.user?.image || undefined}
          alt={session.user?.name || session.user?.email || "User avatar"}
          size={80}
          fallback={fallback}
          className="mb-2"
        />
      </div>
      <p>
        <strong>Name:</strong> {session.user?.name}
      </p>
      <p>
        <strong>Email:</strong> {session.user?.email}
      </p>
      <p>
        <strong>Subscription:</strong>{" "}
        {subscription.isPremium
          ? `Premium (${subscription.plan || "pro"})`
          : "Free"}
      </p>
    </div>
  );
}