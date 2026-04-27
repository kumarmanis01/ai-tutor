/**
 * FILE OBJECTIVE:
 * - Provide centralized FAQ data for use across landing page components (FAQ section + JSON-LD schema).
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/(public)/landing-page/components/faq-data.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-26T00:00:00Z | copilot | extracted FAQ array to separate module for server/client reuse
 * - 2026-04-27T00:00:00Z | copilot | v3 landing page: replace 5-FAQ list with 8 v3-spec questions
 */

export interface FAQ {
  id: number;
  questionEn: string;
  questionHi: string;
  answerEn: string;
  answerHi: string;
  category: string;
}

/**
 * Returns the FAQ data list for the landing page.
 * Called at component load time by both FAQSection (client) and FAQSchemaMarkup (server).
 */
export function getFAQs(): FAQ[] {
  return [
    {
      id: 1,
      questionEn: 'Which boards and exams does Spinzy support?',
      questionHi: 'Spinzy कौन से बोर्ड और परीक्षाओं को सपोर्ट करता है?',
      answerEn:
        'Spinzy supports CBSE, ICSE, Maharashtra Board, UP Board, Tamil Nadu Board, Karnataka Board, and other major State Boards for Classes 6-12. Content is aligned to board-specific syllabi, question paper patterns, and chapter weightages so your preparation is always exam-focused.',
      answerHi:
        'Spinzy CBSE, ICSE, Maharashtra Board, UP Board, Tamil Nadu Board, Karnataka Board और अन्य प्रमुख State Boards को Class 6-12 के लिए सपोर्ट करता है। Content board-specific syllabus, question paper patterns और chapter weightages के अनुसार है।',
      category: 'Coverage',
    },
    {
      id: 2,
      questionEn: 'Is there a free trial? What does it include?',
      questionHi: 'क्या free trial है? उसमें क्या शामिल है?',
      answerEn:
        'Yes -- no credit card required. The free tier includes 5 daily practice questions, a personalised diagnostic test, and a preview of your Learning Map so you can see exactly where your gaps are before subscribing. Your data and progress are fully saved so you never lose work when you upgrade.',
      answerHi:
        'हां -- कोई credit card नहीं चाहिए। Free tier में 5 daily practice questions, एक personalized diagnostic test, और Learning Map का preview शामिल है ताकि आप subscribe करने से पहले अपने gaps देख सकें।',
      category: 'Pricing',
    },
    {
      id: 3,
      questionEn: 'How is Spinzy different from other tutoring apps?',
      questionHi: 'Spinzy अन्य tutoring apps से कैसे अलग है?',
      answerEn:
        "Most apps show you the answer. Spinzy's AI tutor Vidya uses the Socratic method -- asking guiding questions and providing progressive hints so you actually understand the concept. This builds real mastery, not dependency. Think of it as a personal coach, not a homework-answer machine.",
      answerHi:
        'अधिकांश apps सीधे answer दिखाते हैं। Spinzy की AI tutor Vidya Socratic method उपयोग करती है -- guiding questions पूछकर और progressive hints देकर ताकि आप concept सच में समझ सकें। यह real mastery बनाती है।',
      category: 'Product',
    },
    {
      id: 4,
      questionEn: 'Does Spinzy have a parent dashboard?',
      questionHi: 'क्या Spinzy में parent dashboard है?',
      answerEn:
        'Yes. Parents get real-time visibility into their child\'s progress: topics covered, practice accuracy, time spent, and weak areas. You can assign extra practice on any topic, set daily time limits, and receive weekly email reports. Everything is designed so parents stay informed without hovering.',
      answerHi:
        'हां। Parents को real-time visibility मिलती है: topics covered, practice accuracy, time spent, और weak areas। आप किसी भी topic पर extra practice assign कर सकते हैं, daily time limits set कर सकते हैं, और weekly email reports पा सकते हैं।',
      category: 'Parents',
    },
    {
      id: 5,
      questionEn: 'What devices can I use Spinzy on?',
      questionHi: 'मैं Spinzy किन devices पर use कर सकता हूं?',
      answerEn:
        'Spinzy works on any smartphone, tablet, or computer with a modern browser -- no app download required. It is a Progressive Web App (PWA) optimised for budget Android phones on 4G connections. You can also install it to your home screen for an app-like experience.',
      answerHi:
        'Spinzy किसी भी smartphone, tablet, या modern browser वाले computer पर काम करता है -- कोई app download जरूरी नहीं। यह एक Progressive Web App (PWA) है जो budget Android phones पर 4G connection के लिए optimised है।',
      category: 'Technical',
    },
    {
      id: 6,
      questionEn: 'Can I cancel my subscription at any time?',
      questionHi: 'क्या मैं कभी भी subscription cancel कर सकता हूं?',
      answerEn:
        'Yes -- cancel any time directly from the parent dashboard. Access continues until the end of your current billing period, so you never lose days you have already paid for. There are no cancellation fees and no questions asked. We also offer a 30-day money-back guarantee on annual plans.',
      answerHi:
        'हां -- कभी भी parent dashboard से directly cancel करें। Access current billing period के अंत तक जारी रहती है। कोई cancellation fees नहीं, कोई सवाल नहीं। Annual plans पर 30-day money-back guarantee भी है।',
      category: 'Pricing',
    },
    {
      id: 7,
      questionEn: 'Does Spinzy partner with schools?',
      questionHi: 'क्या Spinzy schools के साथ partner करता है?',
      answerEn:
        'We offer institutional partnerships for schools and coaching centres that want to supplement classroom teaching with AI-powered practice. Contact our schools team at schools@spinzyacademy.com to learn about bulk pricing, teacher dashboards, and custom curriculum alignment.',
      answerHi:
        'हम schools और coaching centres के लिए institutional partnerships offer करते हैं जो classroom teaching को AI-powered practice से supplement करना चाहते हैं। schools@spinzyacademy.com पर हमारी schools team से संपर्क करें।',
      category: 'Schools',
    },
    {
      id: 8,
      questionEn: 'How does Spinzy keep student data safe?',
      questionHi: 'Spinzy student data को कैसे safe रखता है?',
      answerEn:
        'Spinzy is compliant with India\'s Digital Personal Data Protection (DPDP) Act. We never sell student data to third parties, never show ads, and require explicit parental consent for users under 18. All data is encrypted at rest and in transit, stored on servers in India, and subject to our publicly available Privacy Policy.',
      answerHi:
        "Spinzy India के Digital Personal Data Protection (DPDP) Act के अनुसार है। हम कभी student data third parties को नहीं बेचते, कभी ads नहीं दिखाते, और 18 वर्ष से कम उम्र के users के लिए explicit parental consent लेते हैं।",
      category: 'Privacy',
    },
  ];
}
