'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import ChatBot from '@/components/Chat/ChatBot';
import AuthModal from '@/components/AuthModal';
import OnboardingForm from '@/app/onboarding/page';

export default function HomePage() {
  const { data: session } = useSession();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    async function checkOnboarding() {
      if (session?.user?.email) {
        const res = await fetch('/api/profile');
        const data = await res.json();
        // If country is missing, require onboarding
        setNeedsOnboarding(!data.country);
      }
    }
    if (session) checkOnboarding();
  }, [session]);

  if (session && needsOnboarding) {
    return <OnboardingForm />;
  }

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
          Learn Smarter with <span className="text-yellow-300">AI Tutor</span>
        </h1>
        <p className="text-lg md:text-2xl max-w-2xl mx-auto mb-8">
          Your personal AI-powered tutor for school, tech, and beyond. Start free with 3 daily
          questions – upgrade for unlimited learning.
        </p>
        <div className="flex justify-center gap-4">
          <button
            onClick={() => setShowAuthModal(true)}
            className="px-6 py-3 rounded-lg bg-yellow-400 text-black font-semibold hover:bg-yellow-300 transition"
          >
            Ask Your First Question
          </button>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="py-16 px-6 max-w-5xl mx-auto grid md:grid-cols-3 gap-10 text-center">
        <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-md">
          <h3 className="text-xl font-bold mb-3 text-indigo-600 dark:text-indigo-300">
            🎓 Personalized Learning
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            Ask questions across subjects – AI adapts to your level of knowledge.
          </p>
        </div>
        <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-md">
          <h3 className="text-xl font-bold mb-3 text-indigo-600 dark:text-indigo-300">
            ⚡ Freemium Access
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            Start free with 3 daily questions. Upgrade to Pro for unlimited queries.
          </p>
        </div>
        <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-md">
          <h3 className="text-xl font-bold mb-3 text-indigo-600 dark:text-indigo-300">
            💳 Simple Pricing
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            Flexible monthly & annual plans via Razorpay – cancel anytime.
          </p>
        </div>
      </section>

      {/* Embedded Tutor (if logged in) */}
      <section className="w-full max-w-4xl mx-auto px-6 py-10">
        <div className="p-10 bg-white dark:bg-gray-800 rounded-2xl shadow-md text-center">
          <h2 className="text-2xl font-bold mb-4 text-indigo-600 dark:text-indigo-300">
            Try Spinzy Academy
          </h2>
          <p className="mb-6 text-gray-600 dark:text-gray-300">
            Sign in to start asking your first 3 free questions today!
          </p>
          <button
            onClick={() => setShowAuthModal(true)}
            className="px-6 py-3 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition"
          >
            Sign In to Start
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

// app/page.tsx
// 'use client';

// import { useSession } from 'next-auth/react';
// import Link from 'next/link';
// import ChatBot from '@/components/Chat/ChatBot';

// export default function HomePage() {
//   const { data: session } = useSession();

//   if (session) {
//     return (
//       <main className="flex flex-col items-center justify-start min-h-screen bg-gray-50 dark:bg-gray-900">
//         <section className="w-full max-w-4xl mx-auto px-6 py-10 flex-1">
//           <ChatBot />
//         </section>
//       </main>
//     );
//   }

//   return (
//     <main className="flex flex-col items-center justify-start min-h-screen bg-gray-50 dark:bg-gray-900">
//       {/* Hero Section */}
//       <section className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 text-white py-20 px-6 text-center">
//         <h1 className="text-4xl md:text-6xl font-extrabold mb-6">
//           Learn Smarter with <span className="text-yellow-300">AI Tutor</span>
//         </h1>

//         <p className="text-lg md:text-2xl max-w-2xl mx-auto mb-8">
//           Your personal AI-powered tutor for school, tech, and beyond. Start free with 3 daily
//           questions – upgrade for unlimited learning.
//         </p>
//         <div className="flex justify-center gap-4">
//           <>
//             <Link
//               href="/auth/signin"
//               className="px-6 py-3 rounded-lg bg-yellow-400 text-black font-semibold hover:bg-yellow-300 transition"
//             >
//               Start Free
//             </Link>
//             {/* <Link
//                 href="/pricing"
//                 className="px-6 py-3 rounded-lg border border-white font-semibold hover:bg-white hover:text-indigo-600 transition"
//               >
//                 Upgrade to Pro
//               </Link> */}
//           </>
//         </div>
//       </section>

//       {/* Feature Highlights */}
//       <section className="py-16 px-6 max-w-5xl mx-auto grid md:grid-cols-3 gap-10 text-center">
//         <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-md">
//           <h3 className="text-xl font-bold mb-3">🎓 Personalized Learning</h3>
//           <p className="text-gray-600 dark:text-gray-300">
//             Ask questions across subjects – AI adapts to your level of knowledge.
//           </p>
//         </div>
//         <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-md">
//           <h3 className="text-xl font-bold mb-3">⚡ Freemium Access</h3>
//           <p className="text-gray-600 dark:text-gray-300">
//             Start free with 3 daily questions. Upgrade to Pro for unlimited queries.
//           </p>
//         </div>
//         <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-md">
//           <h3 className="text-xl font-bold mb-3">💳 Simple Pricing</h3>
//           <p className="text-gray-600 dark:text-gray-300">
//             Flexible monthly & annual plans via Razorpay – cancel anytime.
//           </p>
//         </div>
//       </section>

//       {/* Embedded Tutor (if logged in) */}
//       <section className="w-full max-w-4xl mx-auto px-6 py-10">
//         <div className="p-10 bg-white dark:bg-gray-800 rounded-2xl shadow-md text-center">
//           <h2 className="text-2xl font-bold mb-4">Try AI Tutor</h2>
//           <p className="mb-6 text-gray-600 dark:text-gray-300">
//             Sign in to start asking your first 3 free questions today!
//           </p>
//           <Link
//             href="/auth/signin"
//             className="px-6 py-3 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition"
//           >
//             Sign In to Start
//           </Link>
//         </div>
//       </section>
//     </main>
//   );
// }

// app/page.tsx by vscode copilot
// 'use client';

// import ChatBot from '@/components/Chat/ChatBot';

// export default function HomePage() {
//   return (
//     <div className="max-w-4xl mx-auto p-4 pt-4">
//       {/* Hero Banner */}
//       <section className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow mb-6 py-4 px-4 flex flex-col items-center text-center text-white">
//         <h1 className="text-3xl font-extrabold mb-2">Welcome to Spinzy Academy</h1>
//         <p className="text-base mb-4">
//           Unlock the power of learning in your language.
//           <br />
//           Get instant answers, explanations, and guidance from our AI tutor.
//         </p>
//         <a
//           href="#chat"
//           className="inline-block bg-white text-blue-700 font-semibold px-6 py-2 rounded-full shadow hover:bg-blue-50 transition"
//         >
//           Start Learning Now
//         </a>
//       </section>

//       {/* ChatBot is now immediately visible */}
//       <section id="chat" className="bg-white rounded-lg shadow p-4 min-h-[50vh] flex flex-col">
//         <div className="flex-1 overflow-y-auto">
//           <ChatBot />
//         </div>
//       </section>
//     </div>
//   );
// }
