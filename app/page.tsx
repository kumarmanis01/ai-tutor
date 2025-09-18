// app/page.tsx
import ChatBot from "../components/ChatBot";
import WaitlistForm from "../components/WaitlistForm";

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-3xl bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold mb-3 text-center">AI Tutor</h1>
        <p className="text-sm text-gray-600 text-center mb-6">
          Choose a language from the dropdown, type your question and the AI will reply in that language.
        </p>

        <ChatBot />

        <div className="mt-8">
          <WaitlistForm />
        </div>
      </div>
    </main>
  );
}
