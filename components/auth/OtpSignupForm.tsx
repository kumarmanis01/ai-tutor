'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function OtpSignupForm() {
  const [email, setEmail] = useState('');
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    // Store email so auth page can pre-fill it
    sessionStorage.setItem('spinzy_signup_email', email);
    router.push(`/auth/signup?email=${encodeURIComponent(email)}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col sm:flex-row gap-3 w-full max-w-md mx-auto"
    >
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email to get started"
        className="flex-1 px-4 py-3 rounded-xl border border-gray-300
                   focus:outline-none focus:ring-2 focus:ring-[#534AB7]
                   text-sm bg-white"
        required
      />
      <button
        type="submit"
        className="px-6 py-3 bg-[#534AB7] text-white rounded-xl
                   font-medium text-sm hover:bg-[#4338A0]
                   transition-colors whitespace-nowrap"
      >
        Get started →
      </button>
    </form>
  );
}

export default OtpSignupForm;
