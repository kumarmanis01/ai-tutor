// app/page.tsx
import React from "react";
import ChatBot from "@/components/Chat/ChatBot";
import WaitlistForm from "@/components/WaitlistForm";

export default function Page() {
  return (
    <main
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        backgroundImage: "url('/background.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="w-full max-w-4xl">
        <div className="bg-white/90 dark:bg-gray-900/90 rounded-2xl shadow-lg overflow-hidden">
          <header className="p-4 border-b">
            <h1 className="text-2xl font-semibold">AI Tutor</h1>
            <p className="text-sm text-gray-600">Multilingual tutor — English & Hindi (Phase 2)</p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
            <section className="lg:col-span-1">
              <ChatBot />
            </section>
            <aside className="lg:col-span-1 p-4">
              <WaitlistForm />
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}
