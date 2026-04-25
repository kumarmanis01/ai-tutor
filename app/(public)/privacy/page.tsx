/**
 * FILE OBJECTIVE:
 * - Public privacy policy page (plain-language). Provides English + Hindi versions.
 *
 * LINKED UNIT TEST:
 * - tests/unit/public/privacy.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-17T00:00:00Z | staff-engineer | add Hindi translation + language toggle; update API link client text
 */

'use client';

import { useState } from 'react';

type Lang = 'en' | 'hi';

const translations: Record<Lang, any> = {
  en: {
    title: 'Privacy Policy',
    intro:
      'Your privacy is important to us. Spinzy Academy is committed to protecting your personal information and your right to privacy.',
    infoTitle: 'Information We Collect',
    infoList: [
      'Account information (such as your name, email address, and profile image)',
      'Messages and interactions with the Spinzy Academy',
      'Usage data and analytics',
    ],
    howTitle: 'How We Use Your Information',
    howList: [
      'To provide and improve our services',
      'To personalize your experience',
      'To communicate with you about updates or offers',
      'To ensure security and prevent abuse',
    ],
    choicesTitle: 'Your Choices',
    choicesText:
      'You can access, update, or delete your account information at any time. If you have questions about your privacy, please contact us.',
    lastUpdated: 'Last updated:',
    toggleEn: 'English',
    toggleHi: 'हिन्दी',
  },
  hi: {
    title: 'गोपनीयता नीति',
    intro:
      'हम आपकी गोपनीयता का सम्मान करते हैं। Spinzy Academy आपके व्यक्तिगत जानकारी की सुरक्षा और आपकी गोपनीयता के अधिकार के लिए प्रतिबद्ध है।',
    infoTitle: 'हम कौन सी जानकारी एकत्र करते हैं',
    infoList: [
      'खाता जानकारी (जैसे आपका नाम, ईमेल पता, और प्रोफ़ाइल तस्वीर)',
      'AI ट्यूटर के साथ संदेश और इंटरैक्शन (सारांश दिखाई देंगे; शब्द-दर-शब्द ट्रांसक्रिप्ट निजी रहेगा)',
      'उपयोग डेटा और विश्लेषण',
    ],
    howTitle: 'हम आपकी जानकारी कैसे उपयोग करते हैं',
    howList: [
      'सेवाएँ प्रदान करने और बेहतर बनाने के लिए',
      'आपका अनुभव व्यक्तिगत बनाने के लिए',
      'आपको अपडेट्स या ऑफ़र्स के बारे में सूचित करने के लिए',
      'सुरक्षा सुनिश्चित करने और दुरुपयोग रोकने के लिए',
    ],
    choicesTitle: 'आपके विकल्प',
    choicesText:
      'आप किसी भी समय अपनी खाता जानकारी देख सकते हैं, अपडेट कर सकते हैं, या हटाने का अनुरोध कर सकते हैं। गोपनीयता से संबंधित प्रश्नों के लिए हमसे संपर्क करें।',
    lastUpdated: 'अंतिम अद्यतन:',
    toggleEn: 'English',
    toggleHi: 'हिन्दी',
  },
};

export default function PrivacyPolicyPage() {
  const [lang, setLang] = useState<Lang>('en');
  const t = translations[lang];

  return (
    <div className="max-w-3xl mx-auto p-6 text-gray-900 dark:text-gray-100">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-center text-blue-700 dark:text-yellow-300">
          {t.title}
        </h1>
        <div className="ml-4 flex gap-2">
          <button
            onClick={() => setLang('en')}
            className={`px-3 py-1 rounded ${lang === 'en' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
          >
            {translations.en.toggleEn}
          </button>
          <button
            onClick={() => setLang('hi')}
            className={`px-3 py-1 rounded ${lang === 'hi' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
          >
            {translations.en.toggleHi}
          </button>
        </div>
      </div>

      <p className="mb-4">{t.intro}</p>

      <h2 className="text-xl font-semibold mt-6 mb-2">{t.infoTitle}</h2>
      <ul className="list-disc ml-6 mb-4">
        {t.infoList.map((it: string) => (
          <li key={it}>{it}</li>
        ))}
      </ul>

      <h2 className="text-xl font-semibold mt-6 mb-2">{t.howTitle}</h2>
      <ul className="list-disc ml-6 mb-4">
        {t.howList.map((it: string) => (
          <li key={it}>{it}</li>
        ))}
      </ul>

      <h2 className="text-xl font-semibold mt-6 mb-2">{t.choicesTitle}</h2>
      <p className="mb-4">{t.choicesText}</p>

      <p className="text-gray-500 text-sm">
        {t.lastUpdated} {new Date().getFullYear()}
      </p>
    </div>
  );
}
