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
 * - 2026-04-27T14:30:00Z | copilot | LP-7.1: replace FAQ content with Sprint 7 parent-focused question set
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
      questionEn: "Is Spinzy aligned with my child's school board?",
      questionHi: 'क्या Spinzy मेरे बच्चे के school board के साथ aligned है?',
      answerEn:
        "Yes! We support CBSE, ICSE, and major state boards (Maharashtra, UP, Tamil Nadu, Karnataka). Questions and syllabus match your child's exact board. More boards coming every month.",
      answerHi:
        'हां! हम CBSE, ICSE और प्रमुख state boards (Maharashtra, UP, Tamil Nadu, Karnataka) को support करते हैं। Questions और syllabus आपके बच्चे के board के अनुसार होते हैं।',
      category: 'Coverage',
    },
    {
      id: 2,
      questionEn: 'Can my child try before paying?',
      questionHi: 'क्या मेरा बच्चा payment से पहले try कर सकता है?',
      answerEn:
        'Absolutely. Free users can ask up to 5 questions per week to Teacher Vidya and enjoy full access to study material for the first 30 days. No credit card required. Upgrade anytime to unlock unlimited questions, on-demand notes, and more.',
      answerHi:
        'बिल्कुल। Free users हर हफ्ते Teacher Vidya से 5 सवाल पूछ सकते हैं और पहले 30 दिनों तक सभी study material का पूरा लाभ उठा सकते हैं। कोई credit card नहीं चाहिए। Upgrade करें और unlimited questions, on-demand notes जैसी सुविधाएं पाएं।',
      category: 'Pricing',
    },
        {
          id: 9,
          questionEn: 'What are the limits for free users?',
          questionHi: 'Free users के लिए क्या सीमाएं हैं?',
          answerEn: 'Free users can ask up to 5 questions per week to Teacher Vidya and access all study material for the first 30 days. After 30 days, study material and on-demand notes become premium features. Upgrade anytime to continue learning without limits.',
          answerHi: 'Free users हर हफ्ते Teacher Vidya से 5 सवाल पूछ सकते हैं और पहले 30 दिनों तक सभी study material का लाभ उठा सकते हैं। 30 दिन बाद, study material और on-demand notes premium feature बन जाते हैं। Upgrade करें और बिना किसी सीमा के सीखना जारी रखें।',
          category: 'Limits',
        },
    {
      id: 3,
      questionEn: 'How is Spinzy different from other tutoring apps?',
      questionHi: 'Spinzy दूसरे tutoring apps से कैसे अलग है?',
      answerEn:
        'Most apps just give answers. Spinzy teaches like a real tutor -- hints, analogies, misconception correction. We never give direct answers. Your child actually learns, not just copies.',
      answerHi:
        'ज्यादातर apps सीधे answers देते हैं। Spinzy real tutor की तरह सिखाता है -- hints, analogies और misconception correction के साथ। यहां direct answer नहीं मिलता, असली learning मिलती है।',
      category: 'Product',
    },
    {
      id: 4,
      questionEn: 'Is there a parent dashboard?',
      questionHi: 'क्या parent dashboard उपलब्ध है?',
      answerEn:
        "Yes! Track progress, see weak topics, assign extra practice, and set screen time limits. You'll also receive weekly email reports every Sunday.",
      answerHi:
        'हां! आप progress, weak topics, extra practice assignments और screen time limits track कर सकते हैं। हर रविवार weekly report भी मिलती है।',
      category: 'Parents',
    },
    {
      id: 5,
      questionEn: 'What devices can my child use?',
      questionHi: 'मेरा बच्चा Spinzy किन devices पर use कर सकता है?',
      answerEn:
        'Works on any smartphone, tablet, or computer with a browser. No app download required. We also offer a PWA (installable web app) for one-tap access from home screen.',
      answerHi:
        'Spinzy smartphone, tablet, या computer browser पर चलता है। App download जरूरी नहीं है। PWA install करके home screen से one-tap access भी मिलता है।',
      category: 'Technical',
    },
    {
      id: 6,
      questionEn: 'Can I cancel anytime?',
      questionHi: 'क्या मैं कभी भी cancel कर सकता हूं?',
      answerEn:
        'Yes. Cancel from parent dashboard. Access continues until end of billing period. No hidden fees, no questions asked.',
      answerHi:
        'हां। Parent dashboard से कभी भी cancel कर सकते हैं। Access billing period खत्म होने तक चालू रहता है। कोई hidden fee नहीं।',
      category: 'Pricing',
    },
    {
      id: 7,
      questionEn: 'Do you offer school partnerships?',
      questionHi: 'क्या आप school partnerships offer करते हैं?',
      answerEn:
        'Yes! We work with schools across India. Contact our team at schools@spinzyacademy.com for institutional pricing and teacher dashboards.',
      answerHi:
        'हां! हम भारत के कई schools के साथ काम करते हैं। Institutional pricing और teacher dashboards के लिए schools@spinzyacademy.com पर संपर्क करें।',
      category: 'Schools',
    },
    {
      id: 8,
      questionEn: "Is my child's data safe?",
      questionHi: 'क्या मेरे बच्चे का data सुरक्षित है?',
      answerEn:
        "100% compliant with India's DPDP Act. We never sell data. Parental consent required for all children under 18. All servers are in India.",
      answerHi:
        'हम भारत के DPDP Act के 100% compliant हैं। Data कभी बेचा नहीं जाता। 18 वर्ष से कम उम्र के बच्चों के लिए parental consent जरूरी है। Servers भारत में हैं।',
      category: 'Privacy',
    },
  ];
}
