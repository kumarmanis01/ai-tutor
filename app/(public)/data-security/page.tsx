"use client";

import React from 'react';

export default function DataSecurityPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Data Security</h1>
        <p className="mt-2 text-sm text-gray-600">How Spinzy Academy protects your data and privacy.</p>
      </header>

      <section aria-labelledby="principles" className="mb-8">
        <h2 id="principles" className="text-xl font-semibold">Security Principles</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-gray-800">
          <li><strong>Minimal collection:</strong> We only collect data needed to deliver learning features.</li>
          <li><strong>Explicit consent:</strong> You control microphone/speech features and can disable anytime.</li>
          <li><strong>Privacy by design:</strong> Role-based access and least privilege across systems.</li>
        </ul>
      </section>

      <section aria-labelledby="storage" className="mb-8">
        <h2 id="storage" className="text-xl font-semibold">Storage & Encryption</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-gray-800">
          <li><strong>Database:</strong> Hosted PostgreSQL via managed provider; connections use TLS.</li>
          <li><strong>At rest:</strong> Provider-backed encryption for database and object storage.</li>
          <li><strong>In transit:</strong> All traffic over HTTPS with HSTS; OAuth flows via `next-auth`.</li>
        </ul>
      </section>

      <section aria-labelledby="processing" className="mb-8">
        <h2 id="processing" className="text-xl font-semibold">AI Processing</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-gray-800">
          <li><strong>OpenAI API:</strong> Requests are sent securely using server-side API keys.</li>
          <li><strong>Redaction:</strong> We avoid sending personally identifiable information (PII) in prompts.</li>
          <li><strong>Opt-out:</strong> You can disable AI features in settings if preferred.</li>
        </ul>
      </section>

      <section aria-labelledby="access" className="mb-8">
        <h2 id="access" className="text-xl font-semibold">Access Controls</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-gray-800">
          <li><strong>Authentication:</strong> Secure sessions via `next-auth` with JWT/secure cookies.</li>
          <li><strong>Authorization:</strong> Admin routes protected in middleware; student data is scoped per user.</li>
          <li><strong>Logging:</strong> Structured audit logs for critical operations and API usage.</li>
        </ul>
      </section>

      <section aria-labelledby="retention" className="mb-8">
        <h2 id="retention" className="text-xl font-semibold">Data Retention</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-gray-800">
          <li><strong>Chats & notes:</strong> Retained to personalize learning; you can delete at any time.</li>
          <li><strong>Tests & results:</strong> Stored to show progress history; removable on request.</li>
          <li><strong>Backups:</strong> Managed backups with limited retention windows.</li>
        </ul>
      </section>

      <section aria-labelledby="rights" className="mb-8">
        <h2 id="rights" className="text-xl font-semibold">Your Rights</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-gray-800">
          <li><strong>Access:</strong> View and export your data via the profile/export tools.</li>
          <li><strong>Deletion:</strong> Delete chats, notes, and account data from settings or by contacting support.</li>
          <li><strong>Consent:</strong> Manage language, speech, and AI personalization preferences.</li>
        </ul>
      </section>

      <section aria-labelledby="contact" className="mb-8">
        <h2 id="contact" className="text-xl font-semibold">Contact & Reporting</h2>
        <p className="mt-3 text-gray-800">If you have security questions or wish to report a vulnerability, please reach out via the <a href="/contact-us" className="text-blue-600 underline">contact page</a>.</p>
      </section>

      <footer className="mt-12 border-t pt-6 text-sm text-gray-600">
        <p>
          This page summarizes current practices and may evolve as we improve security and compliance.
          Refer to our <a href="/privacy" className="text-blue-600 underline">Privacy Policy</a> for more details.
        </p>
      </footer>
    </main>
  );
}