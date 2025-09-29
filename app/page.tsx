// app/page.tsx
"use client";

import { useSession } from "next-auth/react";
import ChatBot from "@/components/Chat/ChatBot"; // adjust path if your ChatBot is elsewhere
import { useEffect } from "react";

export default function HomePage() {
  const { data: session, status } = useSession();

  // Optional: if you want to force user to sign in to use the tutor, you can redirect here.
  useEffect(() => {
    // no redirect by default; simply ensure we render the Tutor component
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Welcome / promo area */}
      <header className="mb-6">
        <h1 className="text-3xl font-bold">AI Tutor</h1>
        <p className="text-gray-600">
          Unlock the power of learning in your language! - start by asking a
          question below.
        </p>
      </header>

      {/* Tutor chat area (always visible). ChatBot should handle guest vs signed-in logic. */}
      <section className="bg-white rounded-lg shadow p-4">
        <ChatBot />
      </section>
    </div>
  );
}
