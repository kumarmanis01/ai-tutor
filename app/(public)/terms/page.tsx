'use client';

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto p-6 text-gray-900 dark:text-gray-100">
      <h1 className="text-2xl font-bold text-center mb-4 text-blue-700 dark:text-yellow-300">
        Terms &amp; Conditions
      </h1>
      <p className="mb-4">
        By using Spinzy Academy, you agree to the following terms and conditions. Please read them
        carefully.
      </p>
      <h2 className="text-xl font-semibold mt-6 mb-2">Use of Service</h2>
      <ul className="list-disc ml-6 mb-4">
        <li>Spinzy Academy is for educational purposes only.</li>
        <li>You must not use the service for any unlawful or harmful activities.</li>
        <li>We reserve the right to suspend or terminate accounts that violate these terms.</li>
      </ul>
      <h2 className="text-xl font-semibold mt-6 mb-2">Intellectual Property</h2>
      <p className="mb-4">
        All content, trademarks, and data on this site are the property of Spinzy Academy or its
        licensors.
      </p>
      <h2 className="text-xl font-semibold mt-6 mb-2">Limitation of Liability</h2>
      <p className="mb-4">
        Spinzy Academy is provided &quot;as is&quot; without warranties of any kind. We are not
        liable for any damages arising from your use of the service.
      </p>
      <h2 className="text-xl font-semibold mt-6 mb-2">Changes to Terms</h2>
      <p className="mb-4">
        We may update these terms from time to time. Continued use of the service constitutes
        acceptance of the new terms.
      </p>
      <p className="text-gray-500 text-sm">Last updated: {new Date().getFullYear()}</p>
    </div>
  );
}
