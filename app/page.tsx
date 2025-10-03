'use client';

import ChatBot from '@/components/Chat/ChatBot';

export default function HomePage() {
  return (
    <div className="max-w-4xl mx-auto p-6 pt-20">
      {/* ↑↑↑ Add pt-20 (or adjust as needed) */}
      <header className="mb-6">
        {/* <h1 className="text-3xl font-bold">SpinzyAcademy</h1> */}
        <p className="text-gray-600">
          Unlock the power of learning in your language! - start by asking a question below.
        </p>
      </header>

      <section className="bg-white rounded-lg shadow p-4 h-[60vh] flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <ChatBot />
        </div>
      </section>
    </div>
  );
}
