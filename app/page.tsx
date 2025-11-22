'use client';

import { useSession } from 'next-auth/react';
import { useState } from 'react';
import ChatBot from '@/components/Chat/ChatBot';
import AuthModal from '@/components/AuthModal';
import Testimonials from '@/components/Testimonials';
import { PRICES } from '@/app/api/billing/constants';

export default function HomePage() {
  const { data: session } = useSession();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

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
    <main
      className="flex flex-col items-center justify-start min-h-screen bg-fixed bg-cover bg-center"
      style={{
        backgroundImage: 'url(/images/landing_page_bg.jpg)',
        backgroundSize: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
      }}
    >
      {/* Hero Section */}
      <section className="w-full bg-gradient-to-r from-indigo-600/70 via-purple-600/70 to-pink-500/70 text-white py-20 px-6 text-center">
        <h1 className="text-4xl md:text-6xl font-extrabold mb-6">
          Empower Your Child’s Learning with <span className="text-yellow-300">AI Tutor</span>
        </h1>
        <p className="text-lg md:text-2xl max-w-2xl mx-auto mb-8">
          Solving homework, clarifying doubts, and preparing for exams has never been easier.
        </p>
        <div className="flex justify-center gap-4">
          <button
            onClick={() => setShowAuthModal(true)}
            className="px-6 py-3 rounded-lg bg-yellow-400 text-black font-semibold hover:bg-yellow-300 transition"
          >
            Start Free Trial
          </button>
          <button
            className="px-6 py-3 rounded-lg bg-transparent border-2 border-yellow-400 text-yellow-400 font-semibold hover:bg-yellow-400 hover:text-black transition"
            onClick={() => {
              const demoSection = document.querySelector('[data-section="demo"]');
              if (demoSection) {
                demoSection.scrollIntoView({ behavior: 'smooth' });
              }
            }}
          >
            Watch Demo
          </button>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-16 px-6 max-w-5xl mx-auto grid md:grid-cols-3 gap-10 text-center">
        <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-md">
          <h3 className="text-xl font-bold mb-3 text-indigo-600 dark:text-indigo-300">
            Homework Pressure
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            Struggling to help your child with homework? Let AI Tutor simplify the process.
          </p>
        </div>
        <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-md">
          <h3 className="text-xl font-bold mb-3 text-indigo-600 dark:text-indigo-300">
            Difficulty Understanding Concepts
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            AI Tutor provides clear, step-by-step explanations for better understanding.
          </p>
        </div>
        <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-md">
          <h3 className="text-xl font-bold mb-3 text-indigo-600 dark:text-indigo-300">
            Lack of Personalized Guidance
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            Personalized learning tailored to your child’s needs with AI Tutor.
          </p>
        </div>
      </section>

      {/* Feature Section */}
      <section className="py-16 px-6 max-w-5xl mx-auto grid md:grid-cols-2 gap-10 text-center">
        <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-md">
          <h3 className="text-xl font-bold mb-3 text-indigo-600 dark:text-indigo-300">
            AI Homework Solver
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            Get instant solutions to homework problems with detailed explanations.
          </p>
        </div>
        <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-md">
          <h3 className="text-xl font-bold mb-3 text-indigo-600 dark:text-indigo-300">
            AI Notes Maker
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            Generate concise, easy-to-understand notes for any topic.
          </p>
        </div>
        <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-md">
          <h3 className="text-xl font-bold mb-3 text-indigo-600 dark:text-indigo-300">
            AI Exam Preparation Assistant
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            Personalized quizzes and practice tests to ace exams.
          </p>
        </div>
        <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-md">
          <h3 className="text-xl font-bold mb-3 text-indigo-600 dark:text-indigo-300">
            AI Voice Tutor Mode
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            Learn hands-free with voice-guided tutoring sessions.
          </p>
        </div>
      </section>

      {/* Demo Section */}
      <section className="py-12 px-6 max-w-5xl mx-auto text-center" data-section="demo">
        <h2
          className="p-6 rounded-xl transition-transform transform hover:scale-[1.01] shadow-lg
                 bg-gradient-to-r from-white to-indigo-50 dark:from-gray-900 dark:to-indigo-900
                 border border-indigo-100 dark:border-indigo-800"
        >
          <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Watch a 30-Second Demo
          </h3>

          <div className="aspect-w-16 aspect-h-9">
            <iframe
              className="w-full h-full rounded-lg shadow-md"
              src="https://www.youtube.com/embed/dQw4w9WgXcQ"
              title="AI Tutor Demo Video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
          <div className="mt-8">
            <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-300">
              Explore the App
            </h3>
            <p className="text-gray-500 dark:text-gray-400">[Screenshot Carousel Placeholder]</p>
          </div>
        </h2>
      </section>

      {/* Social Proof Section */}
      <section className="py-12 px-6 max-w-5xl mx-auto text-center">
        <Testimonials />
      </section>

      {/* Pricing Section */}
      <section className="py-12 px-6 max-w-5xl mx-auto text-center">
        {/* <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100"> */}
        <h2
          className="p-6 rounded-xl transition-transform transform hover:scale-[1.01] shadow-lg
                 bg-gradient-to-r from-white to-indigo-50 dark:from-gray-900 dark:to-indigo-900
                 border border-indigo-100 dark:border-indigo-800"
        >
          <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Affordable Pricing Plans
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
              <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">Free</h3>
              <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-300">
                {formatPrice(PRICES.free)}
              </p>
            </div>
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
              <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">Monthly</h3>
              <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-300">
                {formatPrice(PRICES.monthly)}
              </p>
            </div>
            <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
              <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">Annual</h3>
              <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-300">
                {formatPrice(PRICES.annual)}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Includes a money-back guarantee*
            </span>
          </div>
        </h2>
      </section>

      {/* Final CTA Section */}
      <section className="py-12 px-6 max-w-5xl mx-auto text-center">
        <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100">
          Join 10,000+ Parents Transforming Learning
        </h2>
        <button
          onClick={() => setShowAuthModal(true)}
          className="px-6 py-3 rounded-lg bg-yellow-400 text-black font-semibold hover:bg-yellow-300 transition"
        >
          Start Free Trial
        </button>
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
