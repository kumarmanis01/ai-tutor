'use client';

import { useSession } from 'next-auth/react';
import { useState } from 'react';
import ChatBot from '@/components/Chat/ChatBot';
import AuthModal from '@/components/AuthModal';
import Testimonials from '@/components/Testimonials';

export default function HomePage() {
  const { data: session } = useSession();
  const [showAuthModal, setShowAuthModal] = useState(false);

  if (session) {
    return (
      <main className="flex flex-col items-center justify-start min-h-screen bg-gray-50 dark:bg-gray-900">
        <section className="w-full max-w-4xl mx-auto px-6 py-10 flex-1">
          <ChatBot />
        </section>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-start min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero Section */}
      <section className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 text-white py-20 px-6 text-center">
        <h1 className="text-4xl md:text-6xl font-extrabold mb-6">
          Empower Your Learning with <span className="text-yellow-300">AI Tutor</span>
        </h1>
        <p className="text-lg md:text-2xl max-w-2xl mx-auto mb-8">
          The perfect companion for learners of all ages to clarify concepts, nurture curiosity, and
          access quality education from anywhere.
        </p>
        <div className="flex justify-center gap-4">
          <button
            onClick={() => setShowAuthModal(true)}
            className="px-6 py-3 rounded-lg bg-yellow-400 text-black font-semibold hover:bg-yellow-300 transition"
          >
            Start Learning Now
          </button>
        </div>
      </section>

      {/* Why Choose AI Tutor */}
      <section className="py-16 px-6 max-w-5xl mx-auto grid md:grid-cols-3 gap-10 text-center">
        <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-md">
          <h3 className="text-xl font-bold mb-3 text-indigo-600 dark:text-indigo-300">
            🌍 Accessible Anywhere
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            Designed for learners in all locations, providing access to quality education at your
            fingertips.
          </p>
        </div>
        <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-md">
          <h3 className="text-xl font-bold mb-3 text-indigo-600 dark:text-indigo-300">
            🎓 Concept Mastery
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            Clarify doubts and strengthen understanding with personalized AI-driven explanations.
          </p>
        </div>
        <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-md">
          <h3 className="text-xl font-bold mb-3 text-indigo-600 dark:text-indigo-300">
            🔍 Nurture Curiosity
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            Encourage curious minds to explore and learn beyond the classroom with engaging AI
            interactions.
          </p>
        </div>
      </section>

      {/* Testimonials */}
      <section className="w-full max-w-4xl mx-auto px-6 py-10 text-center">
        <Testimonials />
      </section>

      {/* Call to Action */}
      <section className="w-full max-w-4xl mx-auto px-6 py-10">
        <div className="p-10 bg-white dark:bg-gray-800 rounded-2xl shadow-md text-center">
          <h2 className="text-2xl font-bold mb-4 text-indigo-600 dark:text-indigo-300">
            Start Your Journey Today
          </h2>
          <p className="mb-6 text-gray-600 dark:text-gray-300">
            Join thousands of learners who are transforming their learning experience with AI Tutor.
          </p>
          <button
            onClick={() => setShowAuthModal(true)}
            className="px-6 py-3 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition"
          >
            Sign Up for Free
          </button>
        </div>
      </section>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        message="Please login to continue."
      />
    </main>
  );
}
