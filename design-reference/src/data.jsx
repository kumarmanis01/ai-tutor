/* ============================================================
   SPINZY — DEMO DATA
   ============================================================ */

// Tier metadata — labels + color tokens (students NEVER see numbers)
const TIERS = {
  critical: { label: 'Critical',  order: 0, color: 'var(--tier-critical)', soft: 'var(--tier-critical-soft)', pct: 22 },
  weak:     { label: 'Weak',      order: 1, color: 'var(--tier-weak)',     soft: 'var(--tier-weak-soft)',     pct: 40 },
  fair:     { label: 'Fair',      order: 2, color: 'var(--tier-fair)',     soft: 'var(--tier-fair-soft)',     pct: 58 },
  ontrack:  { label: 'On Track',  order: 3, color: 'var(--tier-ontrack)',  soft: 'var(--tier-ontrack-soft)',  pct: 76 },
  strong:   { label: 'Strong',    order: 4, color: 'var(--tier-strong)',   soft: 'var(--tier-strong-soft)',   pct: 92 },
};

// Subjects — color-coded
const SUBJECTS = {
  math:    { id: 'math',    name: 'Mathematics',     short: 'Math',    color: 'var(--subj-math)',    hue: 272, abbr: '∑' },
  science: { id: 'science', name: 'Science',         short: 'Science', color: 'var(--subj-science)', hue: 150, abbr: '⚗' },
  social:  { id: 'social',  name: 'Social Science',  short: 'Social',  color: 'var(--subj-social)',  hue: 45,  abbr: '◷' },
  english: { id: 'english', name: 'English',         short: 'English', color: 'var(--subj-english)', hue: 320, abbr: 'A' },
  hindi:   { id: 'hindi',   name: 'Hindi',           short: 'Hindi',   color: 'var(--subj-hindi)',   hue: 20,  abbr: 'अ' },
};

const STUDENT = {
  name: 'Aarav',
  fullName: 'Aarav Sharma',
  grade: 10,
  board: 'CBSE',
  examName: 'CBSE Board Exam',
  examDateDays: 96,        // normal mode
  streak: 12,
  longestStreak: 24,
  level: 7,
  xp: 1840,
  xpToNext: 2200,
  xpLevelFloor: 1500,
  language: 'English',
  sessionsRemaining: 2,    // freemium
  sessionLimit: 3,
  isPremium: false,
};

const READINESS = [
  { subject: 'math',    tier: 'fair',    trend: +6 },
  { subject: 'science', tier: 'ontrack', trend: +3 },
  { subject: 'social',  tier: 'weak',    trend: -2 },
  { subject: 'english', tier: 'strong',  trend: +1 },
  { subject: 'hindi',   tier: 'fair',    trend: +4 },
];

const NEXT_TOPIC = {
  concept: 'Quadratic Equations — Nature of Roots',
  subject: 'math',
  reason: 'Your weakest fundamental this week',
  minutes: 18,
};

const CONCEPTS = [
  { id: 'c1', name: 'Real Numbers — Euclid’s Lemma', subject: 'math', status: 'COMPLETED', mastery: 88 },
  { id: 'c2', name: 'Polynomials — Zeroes & Coefficients', subject: 'math', status: 'COMPLETED', mastery: 74 },
  { id: 'c3', name: 'Quadratic Equations — Nature of Roots', subject: 'math', status: 'IN_PROGRESS', mastery: 52 },
  { id: 'c4', name: 'Arithmetic Progressions', subject: 'math', status: 'UPCOMING', mastery: 0 },
  { id: 'c5', name: 'Chemical Reactions & Equations', subject: 'science', status: 'COMPLETED', mastery: 81 },
  { id: 'c6', name: 'Acids, Bases & Salts', subject: 'science', status: 'IN_PROGRESS', mastery: 63 },
  { id: 'c7', name: 'Life Processes — Respiration', subject: 'science', status: 'UPCOMING', mastery: 0 },
  { id: 'c8', name: 'Nationalism in India', subject: 'social', status: 'COMPLETED', mastery: 47 },
  { id: 'c9', name: 'Resources & Development', subject: 'social', status: 'UPCOMING', mastery: 0 },
  { id: 'c10', name: 'Footprints Without Feet — Themes', subject: 'english', status: 'COMPLETED', mastery: 90 },
];

const REVISIONS_DUE = [
  { id: 'r1', concept: 'Polynomials — Zeroes & Coefficients', subject: 'math', strength: 0.35 },
  { id: 'r2', concept: 'Chemical Reactions & Equations', subject: 'science', strength: 0.6 },
  { id: 'r3', concept: 'Nationalism in India', subject: 'social', strength: 0.2 },
];
const REVISIONS_UPCOMING = [
  { id: 'r4', concept: 'Real Numbers — Euclid’s Lemma', subject: 'math', strength: 0.8, due: 'Tomorrow' },
  { id: 'r5', concept: 'Footprints Without Feet — Themes', subject: 'english', strength: 0.7, due: 'In 2 days' },
  { id: 'r6', concept: 'Acids, Bases & Salts', subject: 'science', strength: 0.55, due: 'In 4 days' },
];

const WEEKLY_CHALLENGE = {
  title: 'Master 3 Algebra concepts',
  progress: 2, total: 3, xp: 250, daysLeft: 3,
};

// Diagnostic questions
const DIAGNOSTIC_Q = [
  {
    subject: 'math',
    q: 'If the roots of x² − 5x + 6 = 0 are α and β, what is α + β?',
    options: ['5', '6', '−5', '11'], correct: 0,
  },
  {
    subject: 'math',
    q: 'The HCF of 96 and 404 is:',
    options: ['2', '4', '8', '12'], correct: 1,
  },
  {
    subject: 'science',
    q: 'Which gas is released when dilute HCl reacts with zinc?',
    options: ['Oxygen', 'Carbon dioxide', 'Hydrogen', 'Chlorine'], correct: 2,
  },
  {
    subject: 'science',
    q: 'The site of photosynthesis in a plant cell is the:',
    options: ['Mitochondria', 'Ribosome', 'Chloroplast', 'Nucleus'], correct: 2,
  },
  {
    subject: 'social',
    q: 'The Non-Cooperation Movement was launched in the year:',
    options: ['1919', '1920', '1930', '1942'], correct: 1,
  },
];

// Vidya tutor conversation seed
const VIDYA_CONCEPT = { name: 'Nature of Roots', subject: 'math' };
const VIDYA_STREAM = "Great question, Aarav! \uD83C\uDF1F The nature of roots of a quadratic equation ax² + bx + c = 0 is decided entirely by one expression — the discriminant, written as D = b² \u2212 4ac.\n\nThink of D as a traffic signal:\n\u2022 If D > 0 \u2192 two distinct real roots (green light, two clear paths)\n\u2022 If D = 0 \u2192 two equal real roots (one path)\n\u2022 If D < 0 \u2192 no real roots (red light — the roots are imaginary)\n\nSo before solving, you can already *predict* what kind of answer to expect. Want to try finding D for x² \u2212 6x + 9 = 0?";

// Pre-generated LEARNING SESSION (Board + Grade + Subject scoped)
// Steps: note | question | summary. Vidya chat is a provision inside this.
const LESSON = {
  concept: 'Quadratic Equations — Nature of Roots',
  subject: 'math',
  board: 'CBSE', grade: 10, chapter: 'Ch 4 · Quadratic Equations',
  minutes: 18,
  steps: [
    { type: 'objective', title: 'What you\u2019ll learn',
      points: ['What the discriminant D = b² − 4ac means', 'How D decides the nature of roots', 'Predict roots without fully solving'] },
    { type: 'note', kind: 'concept', title: 'The discriminant',
      body: 'For any quadratic ax² + bx + c = 0, the expression under the square root in the quadratic formula is called the discriminant, written D.',
      formula: 'D = b² − 4ac',
      callout: 'D is the single value that tells you what kind of roots to expect — before you solve.' },
    { type: 'note', kind: 'cases', title: 'The three cases',
      cases: [
        { sym: 'D > 0', label: 'Two distinct real roots', tier: 'strong', note: 'Graph cuts the x-axis at 2 points' },
        { sym: 'D = 0', label: 'Two equal real roots', tier: 'ontrack', note: 'Graph just touches the x-axis' },
        { sym: 'D < 0', label: 'No real roots', tier: 'critical', note: 'Graph never meets the x-axis' },
      ] },
    { type: 'note', kind: 'example', title: 'Worked example',
      example: 'Find the nature of roots of  x² − 6x + 9 = 0',
      steps: ['Here a = 1, b = −6, c = 9', 'D = (−6)² − 4(1)(9) = 36 − 36', 'D = 0  →  two equal real roots'],
      answer: 'Roots are real and equal (x = 3, 3)' },
    { type: 'question', q: 'For 2x² − 4x + 5 = 0, the discriminant D = (−4)² − 4(2)(5) = 16 − 40 = −24. What is the nature of roots?',
      options: ['Two distinct real roots', 'Two equal real roots', 'No real roots', 'Cannot be determined'], correct: 2,
      explain: 'D < 0, so the equation has no real roots.' },
    { type: 'question', q: 'A quadratic equation has equal roots. Which condition is true?',
      options: ['D > 0', 'D = 0', 'D < 0', 'D = 1'], correct: 1,
      explain: 'Equal roots occur exactly when the discriminant D = 0.' },
    { type: 'summary', title: 'You\u2019ve got it!',
      points: ['D = b² − 4ac decides everything', 'D > 0 → distinct · D = 0 → equal · D < 0 → none', 'Check D first to predict the answer'],
      xp: 60 },
  ],
};
const LESSON_SUGGESTED_PROMPTS = [
  'Why is it called the discriminant?',
  'What does D < 0 mean on a graph?',
  'Give me another example',
];

// Tests
const TESTS_RECOMMENDED = [
  { id: 't1', name: 'Quadratic Equations — Chapter Test', subject: 'math', q: 15, mins: 20, reason: 'Targets your weak roots concept' },
  { id: 't2', name: 'Acids, Bases & Salts — Quick Check', subject: 'science', q: 10, mins: 12, reason: 'Reinforce yesterday’s session' },
];
const TESTS_UPCOMING = [
  { id: 't3', name: 'Life Processes — Chapter Test', subject: 'science', q: 18, mins: 25, date: 'Unlocks after 2 concepts' },
];
const TESTS_HISTORY = [
  { id: 't4', name: 'Polynomials — Chapter Test', subject: 'math', score: 12, total: 15, xp: 180, date: '3 days ago', tier: 'ontrack' },
  { id: 't5', name: 'Real Numbers — Chapter Test', subject: 'math', score: 14, total: 15, xp: 210, date: '1 week ago', tier: 'strong' },
  { id: 't6', name: 'Nationalism in India — Chapter Test', subject: 'social', score: 6, total: 15, xp: 90, date: '1 week ago', tier: 'weak' },
];

const TEST_RUNNER_Q = [
  { q: 'The discriminant of 2x² − 4x + 2 = 0 is:', options: ['0', '4', '−4', '8'], correct: 0 },
  { q: 'A quadratic with equal roots has discriminant:', options: ['> 0', '= 0', '< 0', 'undefined'], correct: 1 },
  { q: 'Roots of x² + x + 1 = 0 are:', options: ['Real & distinct', 'Real & equal', 'Not real', 'Zero'], correct: 2 },
];

// Subscription plans
const PLANS = {
  free: { name: 'Free', price: 0, sessions: '3 tutor sessions / day', features: ['Diagnostic assessment', 'Limited AI tutor (3/day)', 'Basic progress tracking'] },
  monthly: { name: 'Premium', price: 499, period: '/month', features: ['Unlimited AI tutor sessions', 'Full learning path', 'Mock exams + chapter tests', 'Spaced revision system', 'Detailed progress reports'] },
  annual: { name: 'Premium', price: 3999, period: '/year', save: 'Save 33%', perMonth: '₹333/mo', features: ['Everything in monthly', 'Priority exam-crunch support', 'Parent progress digests', 'Downloadable reports'] },
};

// ---- PARENT DATA ----
const PARENT = { name: 'Mrs. Sharma', phone: '+91 98••• ••432' };
const CHILDREN = [
  {
    id: 'ch1', name: 'Aarav', grade: 10, board: 'CBSE', avatar: 'A',
    hue: 184, lastActive: '2h ago', streak: 12, examDays: 96,
    overallTier: 'fair',
    alerts: [{ type: 'warn', text: 'Social Science slipped to Weak' }],
    subjects: READINESS,
  },
  {
    id: 'ch2', name: 'Diya', grade: 7, board: 'CBSE', avatar: 'D',
    hue: 320, lastActive: 'Yesterday', streak: 4, examDays: 210,
    overallTier: 'ontrack',
    alerts: [{ type: 'info', text: 'Missed 2 sessions this week' }],
    subjects: [
      { subject: 'math', tier: 'ontrack', trend: +2 },
      { subject: 'science', tier: 'strong', trend: +5 },
      { subject: 'english', tier: 'ontrack', trend: 0 },
      { subject: 'hindi', tier: 'fair', trend: -1 },
    ],
  },
];

const ACTIVITY_HEATMAP = [
  // 0=none 1..4 intensity, last 7 weeks x 7 days
  [0,1,2,1,0,3,2],[1,2,3,2,1,0,2],[2,3,4,3,2,1,3],[0,1,2,4,3,2,1],
  [3,2,1,2,4,3,2],[2,4,3,1,2,3,4],[1,2,3,2,4,3,2],
];

const WEAK_TOPICS = [
  { concept: 'Nationalism in India', subject: 'social', tier: 'weak' },
  { concept: 'Quadratic Equations — Roots', subject: 'math', tier: 'fair' },
  { concept: 'Resources & Development', subject: 'social', tier: 'weak' },
];

const BILLING = {
  plan: 'Premium Annual',
  amount: '₹3,999',
  nextDate: '14 Mar 2027',
  method: 'HDFC •••• 4821',
  emi: { enabled: true, total: 4, paid: 2, perMonth: '₹1,000', nextDue: '14 Jun 2026', failed: false },
  methods: [
    { id: 'm1', type: 'card', label: 'HDFC Credit Card', last4: '4821', primary: true },
    { id: 'm2', type: 'upi', label: 'UPI — aarav@oksbi', last4: '', primary: false },
  ],
  invoices: [
    { id: 'inv1', date: '14 Mar 2026', amount: '₹1,000', status: 'Paid' },
    { id: 'inv2', date: '14 Apr 2026', amount: '₹1,000', status: 'Paid' },
    { id: 'inv3', date: '14 May 2026', amount: '₹1,000', status: 'Pending' },
  ],
};

Object.assign(window, {
  TIERS, SUBJECTS, STUDENT, READINESS, NEXT_TOPIC, CONCEPTS,
  REVISIONS_DUE, REVISIONS_UPCOMING, WEEKLY_CHALLENGE, DIAGNOSTIC_Q,
  VIDYA_CONCEPT, VIDYA_STREAM, LESSON, LESSON_SUGGESTED_PROMPTS, TESTS_RECOMMENDED, TESTS_UPCOMING, TESTS_HISTORY,
  TEST_RUNNER_Q, PLANS, PARENT, CHILDREN, ACTIVITY_HEATMAP, WEAK_TOPICS, BILLING,
});
