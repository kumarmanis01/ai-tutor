"use client";

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">About Us</h1>
      <p className="mb-4">
        <strong>AI Tutor</strong> is dedicated to making learning accessible and engaging for everyone, in any language.
      </p>
      <p className="mb-4">
        Our mission is to empower learners worldwide by providing instant, AI-powered answers and explanations in your preferred language. Whether you’re a student, professional, or lifelong learner, AI Tutor is here to support your journey.
      </p>
      <h2 className="text-xl font-semibold mt-6 mb-2">Why Choose AI Tutor?</h2>
      <ul className="list-disc ml-6 mb-4">
        <li>Multilingual support for a global audience</li>
        <li>Instant, reliable answers powered by advanced AI</li>
        <li>Personalized learning experience</li>
        <li>Safe, secure, and privacy-focused</li>
      </ul>
      <p className="mb-4">
        We are constantly expanding our language set and features. Thank you for being part of our community!
      </p>
      <p className="text-gray-500 text-sm">Made with <span className="text-red-500">&hearts;</span> by Spinzy Digital</p>
    </div>
  );
}