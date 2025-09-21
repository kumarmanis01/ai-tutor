// app/page.tsx
"use client";

import ChatBot from "@/components/Chat/ChatBot";
import WaitlistForm from "@/components/WaitlistForm";
import LoginButton from "@/components/Auth/LoginButton";
import UserInfo from "@/components/Auth/UserInfo";
import { useSession } from "next-auth/react";
import Link from "next/link";

export default function Page() {
  const { data: session } = useSession();

  return (
    <main
      className="min-h-screen flex items-start justify-center p-6"
      style={{ backgroundImage: "url('/background.jpg')", backgroundSize: "cover", backgroundPosition: "center" }}
    >
      <div className="w-full max-w-5xl">
        <header className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">AI Tutor</h1>
          <div className="flex items-center gap-3">
            {session ? <UserInfo /> : <LoginButton />}
            <Link href="/profile" className="text-sm underline">Profile</Link>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 bg-white/90 rounded-2xl shadow p-4">
            <ChatBot />
          </section>

          <aside className="bg-white/90 rounded-2xl shadow p-4">
            <WaitlistForm />
          </aside>
        </div>
      </div>
    </main>
  );
}
