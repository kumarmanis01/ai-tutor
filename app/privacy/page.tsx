'use client';

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto p-6 text-gray-900 dark:text-gray-100">
      <h1 className="text-2xl font-bold text-center mb-4 text-blue-700 dark:text-yellow-300">
        Privacy Policy
      </h1>
      <p className="mb-4">
        Your privacy is important to us. Spinzy Academy is committed to protecting your personal
        information and your right to privacy.
      </p>
      <h2 className="text-xl font-semibold mt-6 mb-2">Information We Collect</h2>
      <ul className="list-disc ml-6 mb-4">
        <li>Account information (such as your name, email address, and profile image)</li>
        <li>Messages and interactions with the Spinzy Academy</li>
        <li>Usage data and analytics</li>
      </ul>
      <h2 className="text-xl font-semibold mt-6 mb-2">How We Use Your Information</h2>
      <ul className="list-disc ml-6 mb-4">
        <li>To provide and improve our services</li>
        <li>To personalize your experience</li>
        <li>To communicate with you about updates or offers</li>
        <li>To ensure security and prevent abuse</li>
      </ul>
      <h2 className="text-xl font-semibold mt-6 mb-2">Your Choices</h2>
      <p className="mb-4">
        You can access, update, or delete your account information at any time. If you have
        questions about your privacy, please contact us.
      </p>
      <p className="text-gray-500 text-sm">Last updated: {new Date().getFullYear()}</p>
    </div>
  );
}
