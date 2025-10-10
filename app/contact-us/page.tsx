import React from 'react';

export default function ContactPage() {
  return (
    <div className="max-w-3xl mx-auto p-6 text-gray-900 dark:text-gray-100">
      <h1 className="text-2xl font-bold text-center mb-4 text-blue-700 dark:text-yellow-300">
        Contact Us
      </h1>
      <p className="mb-4">
        We&apos;d love to hear from you! Whether you have questions, feedback, or need support,
        please reach out using the information below.
      </p>
      <h2 className="text-xl font-semibold mt-6 mb-2">Email</h2>
      <p className="mb-4">
        <a href="mailto:support@spinzyacademy.com" className="text-blue-600 underline">
          support@spinzyacademy.com
        </a>
      </p>
      <h2 className="text-xl font-semibold mt-6 mb-2">Phone</h2>
      <p className="mb-4">+91 89207 54675</p>
      <h2 className="text-xl font-semibold mt-6 mb-2">Address</h2>
      <p className="mb-4">
        Spinzy Academy
        <br />
        Sector ETA 2,
        <br />
        Greater Noida, UP, India
      </p>
      <h2 className="text-xl font-semibold mt-6 mb-2">Support Hours</h2>
      <p>Monday to Friday: 10:00 AM – 5:00 PM IST - (GMT+5.30)</p>
    </div>
  );
}
