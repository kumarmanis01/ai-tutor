import React from 'react';

export default function RefundPage() {
  return (
    <div className="max-w-3xl mx-auto p-6 text-gray-900 dark:text-gray-100">
      <h1 className="text-2xl font-bold text-center mb-4 text-blue-700 dark:text-yellow-300">
        Cancellation &amp; Refund Policy
      </h1>
      <p className="mb-4">
        At Spinzy Academy, we strive to provide the best learning experience. If you wish to cancel
        your subscription or request a refund, please review our policy below:
      </p>
      <h2 className="text-xl font-semibold mt-6 mb-2">Cancellation</h2>
      <ul className="list-disc ml-6 mb-4">
        <li>You may cancel your subscription at any time from your account dashboard.</li>
        <li>
          After cancellation, you will retain access to your subscription until the end of your
          current billing cycle.
        </li>
      </ul>
      <h2 className="text-xl font-semibold mt-6 mb-2">Refunds</h2>
      <ul className="list-disc ml-6 mb-4">
        <li>Refunds are available within 7 days of your initial purchase.</li>
        <li>
          To request a refund, please contact our support team at{' '}
          <a href="mailto:support@spinzyacademy.com" className="text-blue-600 underline">
            support@spinzyacademy.com
          </a>{' '}
          with your order details.
        </li>
        <li>Refunds will be processed to your original payment method within 5-7 business days.</li>
      </ul>
      <h2 className="text-xl font-semibold mt-6 mb-2">Need Help?</h2>
      <p>
        If you have any questions or concerns about cancellations or refunds, please reach out to
        our support team. We&apos;re here to help!
      </p>
    </div>
  );
}
