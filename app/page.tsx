'use client';

import ChatBot from '@/components/Chat/ChatBot'; // adjust path if your ChatBot is elsewhere

export default function HomePage() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Welcome / promo area */}
      <header className="mb-6">
        <h1 className="text-3xl font-bold">AI Tutor</h1>
        <p className="text-gray-600">
          Unlock the power of learning in your language! - start by asking a question below.
        </p>
      </header>

      {/* Tutor chat area (always visible). ChatBot should handle guest vs signed-in logic. */}
      <section className="bg-white rounded-lg shadow p-4">
        <ChatBot />
      </section>
    </div>
  );
}
