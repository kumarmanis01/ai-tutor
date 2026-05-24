/**
 * seed-dashboard-test-data.cjs  -  v2 (complete journey)
 *
 * CBSE · Grade 10 · English
 * Curriculum (4 subjects × 2 chapters × 2 topics = 16 topics total):
 *   Science, Mathematics (from seed-taxonomy.cjs)
 *   + Social Science, English Language  (seeded here)
 *
 * 3 Students with end-to-end differentiated journeys:
 *   1. arjun.sharma@test10.cbse  - Struggling (weak Science + SocSci, moderate Math)
 *   2. priya.patel@test10.cbse   - High achiever (all subjects 82-93%, rising trend)
 *   3. ravi.kumar@test10.cbse    - Mixed (strong Math, weak Science, inactive 3 d)
 *
 * 2 Parent accounts:
 *   kavita.sharma@parent.test  → Arjun
 *   suresh.patel@parent.test   → Priya
 *
 * Dashboard layers fully exercised
 * ─────────────────────────────────────────────────────────────
 * Student dashboard
 *   ✓ PrimaryActionCard      P0 homework  / P1 resume session / P5 recommendation
 *   ✓ EngagementSection      StudentStreak + today completion
 *   ✓ WeeklyStudyStrip       sessions this ISO week
 *   ✓ HomeworkPendingCard    PENDING + OVERDUE assignments (top 3)
 *   ✓ WeakTopicsSection      mastery < 0.40 (gate: ≥ 3 total sessions)
 *   ✓ UpcomingTopicsList     getOrderedTopicsForStudent (board/grade/subjects)
 *   ✓ NudgeBanner            daysSinceLastSession / homeworkUrgency / goal-gap
 *
 * Parent dashboard
 *   ✓ ParentWeeklyActivity   sessions + minutes in current ISO week
 *   ✓ ParentSubjectMastery   StudentTopicMastery GROUP BY subject
 *   ✓ ParentWeakTopics       StudentTopicProgress mastery<0.4 AND practiceCount>5
 *   ✓ ParentImprovementTrend StudentTopicMastery AVG(accuracy) per ISO week (8 wks)
 *
 * Progress / Mastery
 *   ✓ StudentTopicMastery    per-topic accuracy + masteryLevel (8-week updatedAt spread)
 *   ✓ StudentTopicProgress   mastery float 0-1, practiceCount
 *   ✓ StudentEngagementStats streak + points
 *   ✓ StudentLearningProfile weakSubjects + targets
 *   ✓ AttentionFlag          low-mastery topics flagged
 *   ✓ ReadinessStatus        per-subject readiness score + label
 *
 * Sessions & Homework
 *   ✓ StructuredSession      COMPLETE (past + this week), active, EXPIRED
 *   ✓ SessionEvent           full event trail for completed sessions
 *   ✓ HomeworkAssignment     PENDING / OVERDUE (with dueDate ≤ NOW+48h) / SUBMITTED / GRADED
 *   ✓ HomeworkAnswer         for submitted + graded
 *   ✓ LearningSession        legacy record (P1 fallback in getNextAction)
 *
 * Recommendations
 *   ✓ ContentCatalog         candidates for recommendation engine
 *   ✓ ContentRecommendation  shown / clicked / completed / ignored states
 *   ✓ RecommendationTrace    scoring audit trail
 *   ✓ DailyTask              today's personalized task
 *
 * Weekly summaries
 *   ✓ WeeklyStudentSummary   8 weeks (parent weekly-activity + improvement trend)
 *   ✓ SubjectProgressSummary per-subject snapshot
 *
 * Idempotent: uses upsert / skipDuplicates throughout.
 * Prerequisite: node scripts/seed-taxonomy.cjs
 *
 * Usage:
 *   node scripts/seed-dashboard-test-data.cjs           # live run
 *   node scripts/seed-dashboard-test-data.cjs --dry-run # print plan, no DB
 */

'use strict';

const fs   = require('fs');
const path = require('path');

require('./_env-loader').loadEnv();
const { PrismaClient } = require('@prisma/client');

const DRY_RUN = process.argv.includes('--dry-run');
let prisma = null;
if (!DRY_RUN) {
  prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
}

// ── date helpers ─────────────────────────────────────────────────────────────
const NOW = new Date();
function daysAgo(n)  { const d = new Date(NOW); d.setDate(d.getDate() - n); return d; }
function weeksAgo(n) { return daysAgo(n * 7); }
function hoursAgo(n) { const d = new Date(NOW); d.setHours(d.getHours() - n); return d; }
function hoursFromNow(n) { const d = new Date(NOW); d.setHours(d.getHours() + n); return d; }
function addMinutes(d, m) { return new Date(d.getTime() + m * 60000); }

/** Monday 00:00 UTC of the ISO week containing `date` */
function isoWeekStart(date) {
  const d = new Date(date);
  const day = d.getUTCDay();           // 0=Sun
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1));
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
/** ISO week label  e.g. "2026-W10" */
function isoWeekLabel(date) {
  const d = new Date(date);
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const startOfWeek1 = isoWeekStart(jan4);
  const diff = d - startOfWeek1;
  const week = Math.floor(diff / 604800000) + 1;
  return `${d.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
}

// ── report state ─────────────────────────────────────────────────────────────
const REPORT = { passes: [], warnings: [], counts: {}, students: {} };
const pass = (msg) => REPORT.passes.push(msg);
const warn = (msg) => REPORT.warnings.push(msg);

// ============================================================================
// CURRICULUM DEFINITIONS
// ============================================================================
const BOARD_SLUG = 'cbse';
const GRADE      = 10;

function buildNote(title, intro, sections, keyTerms, examples) {
  return {
    introduction: intro,
    learningObjectives: sections.map(s => s.keyTakeaway || `Understand ${s.heading}`),
    sections, keyTerms, realWorldExamples: examples,
    commonMistakes: [
      { mistake: 'Memorising without understanding.', correction: 'Focus on the "why".' },
      { mistake: 'Skipping units in answers.', correction: 'Always include correct SI units.' },
    ],
    summary: `${title}: ${intro.split('.').slice(0, 2).join('.')}.`,
    funFact: 'Did you know? This concept shaped the modern world and is still relevant today!',
    relatedTopics: [],
    studyTips: [
      'Read the full note once before solving problems.',
      'Make a mind-map linking key terms.',
      'Attempt at least 5 exam-style questions.',
    ],
  };
}

function questionsForTopic(topicName) {
  return {
    easy: [
      { type: 'mcq', question: `Which best describes ${topicName}?`,
        options: ['A core CBSE Grade 10 concept', 'An advanced college topic', 'Outside the syllabus', 'Unrelated'], answer: 'A core CBSE Grade 10 concept', explanation: `${topicName} is fundamental to the curriculum.`, marks: 1 },
      { type: 'short_answer', question: `Define ${topicName} in two sentences.`,
        options: null, answer: 'State the core idea and its scope.', explanation: 'A good definition is precise and contextual.', marks: 2 },
    ],
    medium: [
      { type: 'mcq', question: `Which principle applies directly to ${topicName}?`,
        options: ['The primary principle of this topic', "Newton's 3rd law", "Archimedes' principle", "Boyle's law"], answer: 'The primary principle of this topic', explanation: `The core rule of ${topicName} governs this scenario.`, marks: 2 },
      { type: 'short_answer', question: `Explain with an example how ${topicName} is applied.`,
        options: null, answer: `Apply the concept of ${topicName} with a worked example.`, explanation: 'Application questions test deeper understanding.', marks: 3 },
    ],
    hard: [
      { type: 'mcq', question: `In a complex scenario involving ${topicName}, changing initial conditions leads to:`,
        options: ['A proportional change', 'No change', 'A zero result', 'An unpredictable outcome'], answer: 'A proportional change', explanation: `Proportional reasoning is central to ${topicName}.`, marks: 3 },
      { type: 'short_answer', question: `Compare two approaches for solving problems in ${topicName}. Which is more efficient?`,
        options: null, answer: 'Analyse trade-offs: accuracy, speed, and applicability.', explanation: 'Higher-order questions require evaluation skills.', marks: 4 },
    ],
  };
}

const EXTRA_SUBJECTS = [
  // ── Social Science ───────────────────────────────────────────────────────
  {
    name: 'Social Science', slug: 'social-science',
    chapters: [
      {
        name: 'Nationalism in India', slug: 'nationalism-in-india', order: 1,
        topics: [
          {
            name: 'Non-Cooperation Movement', slug: 'non-cooperation-movement', order: 1,
            note: buildNote('Non-Cooperation Movement',
              'The Non-Cooperation Movement (1920-22), led by Mahatma Gandhi, was the first mass movement that united Indians across regions to resist British rule by refusing to cooperate with colonial institutions.',
              [
                { heading: 'Origins and Launch',
                  explanation: 'Triggered by the Jallianwala Bagh massacre (1919) and Khilafat grievances, Gandhi proposed non-cooperation at the Nagpur session of the INC (December 1920). Indians surrendered titles, boycotted civil services, army, courts, and government schools.',
                  keyTakeaway: 'Non-cooperation = withdrawal from all British institutions + swadeshi.' },
                { heading: 'Spread and Withdrawal',
                  explanation: 'The movement spread to towns and villages. It was called off after Chauri Chaura (February 1922) where a crowd burned a police station. Gandhi believed satyagrahis were not ready for mass civil disobedience.',
                  keyTakeaway: 'Chauri Chaura incident → suspension of movement; satyagraha must remain non-violent.' },
              ],
              [
                { term: 'Satyagraha', definition: 'Truth-force; resistance through non-violent means.', example: 'Gandhi used satyagraha in South Africa before India.' },
                { term: 'Khilafat Issue', definition: "Muslims' concern over the Ottoman Caliph after WWI.", example: 'Congress supported the Khilafat Committee in 1919.' },
              ],
              [{ scenario: 'Students boycotting government schools during Non-Cooperation.', connection: 'This showed ordinary people could challenge colonial authority at scale.' }]),
          },
          {
            name: 'Civil Disobedience Movement', slug: 'civil-disobedience-movement', order: 2,
            note: buildNote('Civil Disobedience Movement',
              'The Civil Disobedience Movement (1930-34) began with the Dandi March, in which Gandhi walked 240 miles to make salt from seawater, defying the British salt tax.',
              [
                { heading: 'Dandi March and Salt Satyagraha',
                  explanation: 'On 12 March 1930 Gandhi left Sabarmati Ashram reaching Dandi on 6 April to make salt illegally. People across India broke the salt law, boycotted foreign cloth and liquor. Women participated in large numbers for the first time.',
                  keyTakeaway: 'Dandi March → salt as symbol of colonial exploitation → mass civil disobedience.' },
                { heading: 'Gandhi-Irwin Pact and Aftermath',
                  explanation: 'In March 1931 Gandhi signed the Gandhi-Irwin Pact: release of political prisoners and permission for salt collection on the coast. Congress agreed to attend the Round Table Conference. The second conference (London, 1931) failed; CDM resumed 1932 and was formally withdrawn 1934.',
                  keyTakeaway: 'Gandhi-Irwin Pact = temporary truce; movement resumed 1932, withdrawn 1934.' },
              ],
              [
                { term: 'Civil Disobedience', definition: 'Deliberate, non-violent refusal to obey specific unjust laws.', example: 'Breaking the salt law was a direct challenge to a specific colonial regulation.' },
                { term: 'Dandi March', definition: '240-mile march to the sea led by Gandhi in March-April 1930 to protest the salt tax.', example: 'The march lasted 24 days and triggered nationwide satyagraha.' },
              ],
              [{ scenario: 'Comparing Non-Cooperation (1920) and Civil Disobedience (1930).', connection: 'CDM directly broke specific laws (salt tax); NCM focused on withdrawal. CDM had greater mass participation.' }]),
          },
        ],
      },
      {
        name: 'Resources and Development', slug: 'resources-and-development', order: 2,
        topics: [
          {
            name: 'Types of Resources', slug: 'types-of-resources', order: 1,
            note: buildNote('Types of Resources',
              'Resources are everything in our environment that can be used to satisfy our needs. They are classified by origin, exhaustibility, ownership, and status of development.',
              [
                { heading: 'Origin and Exhaustibility',
                  explanation: 'By origin: biotic (living, e.g. forests, fish) and abiotic (non-living, e.g. rocks, metals). By exhaustibility: renewable (replenishable, e.g. solar, water) and non-renewable (finite, e.g. coal, petroleum).',
                  keyTakeaway: 'Renewable ↔ replenishable; Non-renewable ↔ exhaustible over geological time.' },
                { heading: 'Ownership and Development Status',
                  explanation: 'By ownership: individual, community, national, international. By development status: potential, developed, stock, reserves.',
                  keyTakeaway: '4 ownership types × 4 development-status types = classification matrix.' },
              ],
              [
                { term: 'Biotic Resources', definition: 'Resources from the biosphere (living component).', example: 'Forests, animals, fish, birds.' },
                { term: 'Non-renewable Resources', definition: 'Resources that cannot be replenished once used.', example: 'Coal, petroleum, natural gas.' },
              ],
              [{ scenario: "India's coal reserves are depleting rapidly due to industrial use.", connection: 'Coal is a non-renewable abiotic national resource -- once exhausted it cannot be renewed, driving the shift to solar/wind.' }]),
          },
          {
            name: 'Land Use Pattern in India', slug: 'land-use-pattern-in-india', order: 2,
            note: buildNote('Land Use Pattern in India',
              'Land use refers to the purpose for which land is used. In India, data is collected by the Survey of India and reported in seven categories.',
              [
                { heading: 'Categories of Land Use',
                  explanation: 'The seven categories: (1) Forests, (2) Land not available for cultivation, (3) Other uncultivated land, (4) Fallow lands, (5) Net sown area. Forest area in India (≈23%) is below the National Forest Policy target of 33%.',
                  keyTakeaway: 'Net sown area + fallow = gross cropped area. Forests cover ~23% vs 33% target.' },
                { heading: 'Factors and Conservation',
                  explanation: 'Physical factors: topography, climate, soil. Human factors: population, technology. Degradation: erosion, waterlogging, salinisation, desertification. Conservation: crop rotation, contour ploughing, terrace farming.',
                  keyTakeaway: 'Degradation causes + conservation methods are both exam-important.' },
              ],
              [
                { term: 'Net Sown Area', definition: 'Land sown with crops at least once in a year.', example: 'Punjab has the highest net sown area as % of total area.' },
                { term: 'Fallow Land', definition: 'Cultivable land left uncultivated to restore fertility.', example: 'Current fallow: left uncultivated in the current year.' },
              ],
              [{ scenario: 'Farmer leaves land uncultivated every third year.', connection: 'This is fallow land practice -- it restores soil nutrients naturally.' }]),
          },
        ],
      },
    ],
  },

  // ── English Language ──────────────────────────────────────────────────────
  {
    name: 'English Language', slug: 'english-language',
    chapters: [
      {
        name: 'First Flight - Literature', slug: 'first-flight-literature', order: 1,
        topics: [
          {
            name: 'A Letter to God - Comprehension', slug: 'a-letter-to-god', order: 1,
            note: buildNote('A Letter to God',
              '"A Letter to God" by G.L. Fuentes tells the story of Lencho, a farmer whose unwavering faith in God is contrasted ironically with his suspicion of the kind humans who helped him.',
              [
                { heading: 'Plot and Characters',
                  explanation: "Lencho's crops are destroyed by a hailstorm. He writes to God asking for 100 pesos. The postmaster, moved by his faith, collects 70 pesos from staff and sends it anonymously. Lencho, receiving only 70 pesos, writes again accusing post office employees of stealing the rest.",
                  keyTakeaway: 'Lencho = blind faith; Post office = human kindness; Irony = helpers accused of theft.' },
                { heading: 'Themes and Literary Devices',
                  explanation: 'Themes: unwavering faith, irony of human kindness going unrecognised. Literary devices: personification (rain like locusts), metaphor, irony. The story questions whether blind faith ignores human goodness.',
                  keyTakeaway: 'Theme: faith vs irony of unrecognised human kindness.' },
              ],
              [
                { term: 'Irony', definition: 'A literary device where the outcome is contrary to expectation.', example: 'Lencho accuses the kind helpers of being thieves.' },
                { term: 'Personification', definition: 'Giving human qualities to non-human things.', example: '"The rain was like new coins" -- comparing rain to money.' },
              ],
              [{ scenario: 'Lencho receives 70 pesos instead of 100.', connection: "He interprets the shortage as theft, never considering the post office employees donated their own money -- the story's tragic irony." }]),
          },
          {
            name: 'Nelson Mandela - Long Walk to Freedom', slug: 'nelson-mandela-long-walk-to-freedom', order: 2,
            note: buildNote('Nelson Mandela - Long Walk to Freedom',
              "This excerpt from Nelson Mandela's autobiography describes his inauguration as South Africa's first black President and his reflections on freedom, courage, and human obligation.",
              [
                { heading: 'The Inauguration Scene',
                  explanation: 'The ceremony was held at the Union Buildings, Pretoria. Military generals who had previously jailed Mandela now saluted him -- a victory for justice. He saw the transformation of the apartheid state into one that recognised the rights of all.',
                  keyTakeaway: 'Inauguration = triumph of justice; former oppressors saluted Mandela.' },
                { heading: 'Meaning of Freedom and Courage',
                  explanation: 'Mandela distinguishes two obligations: to family and to people/community. The oppressor is also a prisoner of hatred. True freedom = freedom of all. Courage = triumph over fear, not its absence.',
                  keyTakeaway: 'Freedom = freedom of all; Courage = triumph over fear, not its absence.' },
              ],
              [
                { term: 'Apartheid', definition: 'Institutionalised racial segregation in South Africa, 1948-1994.', example: 'Black South Africans were denied voting rights and freedom of movement.' },
                { term: 'Inauguration', definition: 'Formal ceremony inducting a person into a position of authority.', example: "Mandela's inauguration on 10 May 1994 marked the end of apartheid." },
              ],
              [{ scenario: "Mandela's reflection on generals who jailed him now saluting him.", connection: 'Symbolises the complete transformation of South Africa -- the oppressor system bowing to human dignity.' }]),
          },
        ],
      },
      {
        name: 'Grammar and Writing Skills', slug: 'grammar-and-writing-skills', order: 2,
        topics: [
          {
            name: 'Tenses and Sentence Transformation', slug: 'tenses-and-sentence-transformation', order: 1,
            note: buildNote('Tenses and Sentence Transformation',
              'Mastery of tenses and sentence transformation (active/passive, direct/indirect speech) is essential for the CBSE Class 10 English grammar section.',
              [
                { heading: 'Tenses Overview',
                  explanation: '12 tenses = 3 time frames × 4 aspects. Key for exams: Simple Present, Present Perfect, Simple Past, Past Perfect. Passive formula: Object + be (correct tense) + past participle.',
                  keyTakeaway: '12 tenses = 3 time frames × 4 aspects. Passive = be + past participle.' },
                { heading: 'Sentence Transformation',
                  explanation: 'Active to Passive: swap subject/object, add "be", use past participle. Direct to Indirect: backshift tense, change pronouns, adjust time expressions, remove quotation marks.',
                  keyTakeaway: 'Active→Passive: swap + "be" + past participle. Direct→Indirect: backshift + pronoun change.' },
              ],
              [
                { term: 'Present Perfect', definition: 'Tense for actions completed recently or with present relevance. Form: have/has + past participle.', example: '"She has finished her homework."' },
                { term: 'Passive Voice', definition: 'Sentence structure where the subject receives the action.', example: '"The book was written by Rowling" (passive).' },
              ],
              [{ scenario: 'Exam: Change to passive: "The teacher corrects the papers."', connection: '"The papers are corrected by the teacher." -- Object (papers) + are + corrected + by + agent.' }]),
          },
          {
            name: 'Formal Letter Writing', slug: 'formal-letter-writing', order: 2,
            note: buildNote('Formal Letter Writing',
              'Formal letter writing is a key skill in the CBSE Class 10 English exam (Section B - Writing). It includes formal/official letters, application letters, and complaint letters, each with a fixed format.',
              [
                { heading: 'Format of a Formal Letter',
                  explanation: "8-part format: (1) Sender's address, (2) Date, (3) Receiver's designation & address, (4) Subject line, (5) Salutation, (6) Body (3 paragraphs), (7) Complimentary close, (8) Signature. 'Yours faithfully' when you don't know the name; 'Yours sincerely' when you do.",
                  keyTakeaway: "8-part format: address → date → receiver → subject → salutation → body → close → sign." },
                { heading: 'Types and Common Errors',
                  explanation: "Types: (a) Letter to editor, (b) Letter to authority, (c) Letter of application. Common errors: missing subject line, wrong close, contractions in body. Use passive voice for polite distancing (\"It is requested that...\").",
                  keyTakeaway: "Three types: editor / authority / application. No contractions; state purpose early." },
              ],
              [
                { term: 'Salutation', definition: 'The greeting line at the start of a letter body.', example: '"Dear Sir/Madam" (name unknown); "Dear Mr. Sharma" (name known).' },
                { term: 'Complimentary Close', definition: 'The polite ending before the signature.', example: '"Yours faithfully" when salutation is Sir/Madam.' },
              ],
              [{ scenario: 'Write to Municipal Commissioner about waterlogging in your colony.', connection: "Letter to authority: salutation 'Dear Sir/Madam', subject 'Waterlogging in XYZ Colony', 3-paragraph body, close 'Yours faithfully'." }]),
          },
        ],
      },
    ],
  },
];

// ============================================================================
// CURRICULUM SEED
// ============================================================================

async function seedCurriculum(classLevel) {
  const stats = { subjects: 0, chapters: 0, topics: 0, notes: 0, tests: 0, questions: 0 };
  for (const subj of EXTRA_SUBJECTS) {
    const subject = await prisma.subjectDef.upsert({
      where: { classId_slug: { classId: classLevel.id, slug: subj.slug } },
      update: {},
      create: { classId: classLevel.id, name: subj.name, slug: subj.slug },
    });
    stats.subjects++;
    for (const ch of subj.chapters) {
      const chapter = await prisma.chapterDef.upsert({
        where: { subjectId_slug_version: { subjectId: subject.id, slug: ch.slug, version: 1 } },
        update: { name: ch.name, order: ch.order, status: 'approved' },
        create: { subjectId: subject.id, name: ch.name, slug: ch.slug, order: ch.order, version: 1, status: 'approved' },
      });
      stats.chapters++;
      for (const tp of ch.topics) {
        const topic = await prisma.topicDef.upsert({
          where: { chapterId_slug: { chapterId: chapter.id, slug: tp.slug } },
          update: { name: tp.name, order: tp.order, status: 'approved' },
          create: { chapterId: chapter.id, name: tp.name, slug: tp.slug, order: tp.order, status: 'approved' },
        });
        stats.topics++;
        await prisma.topicNote.upsert({
          where: { topicId_language_version: { topicId: topic.id, language: 'en', version: 1 } },
          update: { title: tp.name, contentJson: tp.note, status: 'approved', source: 'seed-dashboard' },
          create: { topicId: topic.id, language: 'en', version: 1, title: tp.name, contentJson: tp.note, status: 'approved', source: 'seed-dashboard' },
        });
        stats.notes++;
        const qBank = questionsForTopic(tp.name);
        for (const diff of ['easy', 'medium', 'hard']) {
          const test = await prisma.generatedTest.upsert({
            where: { topicId_difficulty_language_version: { topicId: topic.id, difficulty: diff, language: 'en', version: 1 } },
            update: { title: `${tp.name} - ${diff[0].toUpperCase() + diff.slice(1)}`, status: 'approved' },
            create: { topicId: topic.id, title: `${tp.name} - ${diff[0].toUpperCase() + diff.slice(1)}`, difficulty: diff, language: 'en', version: 1, status: 'approved' },
          });
          await prisma.generatedQuestion.deleteMany({ where: { testId: test.id } });
          await prisma.generatedQuestion.createMany({ data: qBank[diff].map(q => ({ testId: test.id, ...q })) });
          stats.tests++;
          stats.questions += qBank[diff].length;
        }
      }
    }
  }
  return stats;
}

// ── fetch all topics from DB, build lookup map ────────────────────────────────
async function fetchTopicMap() {
  const board = await prisma.board.findUnique({ where: { slug: BOARD_SLUG } });
  if (!board) throw new Error(`Board '${BOARD_SLUG}' not found. Run seed-taxonomy.cjs first.`);
  const classLevel = await prisma.classLevel.findUnique({
    where: { boardId_grade: { boardId: board.id, grade: GRADE } },
  });
  if (!classLevel) throw new Error(`ClassLevel ${GRADE} not found for CBSE.`);
  const subjects = await prisma.subjectDef.findMany({
    where: { classId: classLevel.id },
    include: { chapters: { include: { topics: true } } },
  });
  // map: subjectSlug → chapterSlug → topicSlug → topic
  const map = {};
  for (const s of subjects) {
    map[s.slug] = {};
    for (const ch of s.chapters) {
      map[s.slug][ch.slug] = {};
      for (const tp of ch.topics) map[s.slug][ch.slug][tp.slug] = tp;
    }
  }
  return { board, classLevel, subjects, map };
}

// ============================================================================
// PER-TOPIC MASTERY PLAN
// weekAgo=N  →  updatedAt = weeksAgo(N), so the 8-week trend chart has data
// accuracy   →  StudentTopicMastery.accuracy (%)
// masteryFloat → StudentTopicProgress.mastery  (0-1)
// practiceCount → must be > 5 for ParentWeakTopics (mastery < 0.4 AND practiceCount > 5)
// ============================================================================

const MASTERY_PLAN = {
  // ── Arjun (struggling: Science weak 30-42%, SocSci weak 30-38%, Math moderate 63-69%) ──
  arjun: [
    { sSlug:'science', cSlug:'electricity',                     tSlug:'electric-current-and-circuit',           weekAgo:8, accuracy:34, level:'beginner',     attempts:8,  practiceCount:8,  masteryFloat:0.34 },
    { sSlug:'science', cSlug:'electricity',                     tSlug:'ohms-law-and-resistance',                weekAgo:7, accuracy:37, level:'beginner',     attempts:9,  practiceCount:9,  masteryFloat:0.37 },
    { sSlug:'science', cSlug:'chemical-reactions-and-equations',tSlug:'types-of-chemical-reactions',            weekAgo:6, accuracy:39, level:'beginner',     attempts:7,  practiceCount:7,  masteryFloat:0.39 },
    { sSlug:'science', cSlug:'chemical-reactions-and-equations',tSlug:'balancing-chemical-equations',           weekAgo:5, accuracy:43, level:'beginner',     attempts:6,  practiceCount:6,  masteryFloat:0.43 },
    { sSlug:'mathematics', cSlug:'real-numbers',                tSlug:'euclids-division-lemma',                 weekAgo:4, accuracy:63, level:'intermediate', attempts:12, practiceCount:12, masteryFloat:0.63 },
    { sSlug:'mathematics', cSlug:'real-numbers',                tSlug:'fundamental-theorem-of-arithmetic',      weekAgo:3, accuracy:65, level:'intermediate', attempts:11, practiceCount:11, masteryFloat:0.65 },
    { sSlug:'mathematics', cSlug:'pair-of-linear-equations',    tSlug:'graphical-method-of-solution',           weekAgo:2, accuracy:67, level:'intermediate', attempts:10, practiceCount:10, masteryFloat:0.67 },
    { sSlug:'mathematics', cSlug:'pair-of-linear-equations',    tSlug:'algebraic-methods-substitution-elimination', weekAgo:1, accuracy:69, level:'intermediate', attempts:9, practiceCount:9, masteryFloat:0.69 },
    { sSlug:'social-science', cSlug:'nationalism-in-india',     tSlug:'non-cooperation-movement',               weekAgo:8, accuracy:30, level:'beginner',     attempts:7,  practiceCount:7,  masteryFloat:0.30 },
    { sSlug:'social-science', cSlug:'nationalism-in-india',     tSlug:'civil-disobedience-movement',            weekAgo:7, accuracy:32, level:'beginner',     attempts:8,  practiceCount:8,  masteryFloat:0.32 },
    { sSlug:'social-science', cSlug:'resources-and-development',tSlug:'types-of-resources',                     weekAgo:6, accuracy:35, level:'beginner',     attempts:6,  practiceCount:6,  masteryFloat:0.35 },
    { sSlug:'social-science', cSlug:'resources-and-development',tSlug:'land-use-pattern-in-india',              weekAgo:5, accuracy:38, level:'beginner',     attempts:5,  practiceCount:5,  masteryFloat:0.38 },
  ],
  // ── Priya (high achiever: all 82-93%, upward trend over 8 weeks) ──────────
  priya: [
    { sSlug:'science', cSlug:'electricity',                     tSlug:'electric-current-and-circuit',           weekAgo:8, accuracy:82, level:'advanced', attempts:20, practiceCount:20, masteryFloat:0.82 },
    { sSlug:'science', cSlug:'electricity',                     tSlug:'ohms-law-and-resistance',                weekAgo:8, accuracy:84, level:'advanced', attempts:18, practiceCount:18, masteryFloat:0.84 },
    { sSlug:'science', cSlug:'chemical-reactions-and-equations',tSlug:'types-of-chemical-reactions',            weekAgo:7, accuracy:85, level:'advanced', attempts:19, practiceCount:19, masteryFloat:0.85 },
    { sSlug:'science', cSlug:'chemical-reactions-and-equations',tSlug:'balancing-chemical-equations',           weekAgo:7, accuracy:87, level:'advanced', attempts:17, practiceCount:17, masteryFloat:0.87 },
    { sSlug:'mathematics', cSlug:'real-numbers',                tSlug:'euclids-division-lemma',                 weekAgo:6, accuracy:88, level:'advanced', attempts:18, practiceCount:18, masteryFloat:0.88 },
    { sSlug:'mathematics', cSlug:'real-numbers',                tSlug:'fundamental-theorem-of-arithmetic',      weekAgo:6, accuracy:89, level:'advanced', attempts:17, practiceCount:17, masteryFloat:0.89 },
    { sSlug:'mathematics', cSlug:'pair-of-linear-equations',    tSlug:'graphical-method-of-solution',           weekAgo:5, accuracy:90, level:'expert',   attempts:16, practiceCount:16, masteryFloat:0.90 },
    { sSlug:'mathematics', cSlug:'pair-of-linear-equations',    tSlug:'algebraic-methods-substitution-elimination', weekAgo:5, accuracy:91, level:'expert', attempts:15, practiceCount:15, masteryFloat:0.91 },
    { sSlug:'social-science', cSlug:'nationalism-in-india',     tSlug:'non-cooperation-movement',               weekAgo:4, accuracy:88, level:'advanced', attempts:16, practiceCount:16, masteryFloat:0.88 },
    { sSlug:'social-science', cSlug:'nationalism-in-india',     tSlug:'civil-disobedience-movement',            weekAgo:4, accuracy:90, level:'expert',   attempts:15, practiceCount:15, masteryFloat:0.90 },
    { sSlug:'social-science', cSlug:'resources-and-development',tSlug:'types-of-resources',                     weekAgo:3, accuracy:91, level:'expert',   attempts:14, practiceCount:14, masteryFloat:0.91 },
    { sSlug:'social-science', cSlug:'resources-and-development',tSlug:'land-use-pattern-in-india',              weekAgo:3, accuracy:92, level:'expert',   attempts:14, practiceCount:14, masteryFloat:0.92 },
    { sSlug:'english-language', cSlug:'first-flight-literature',tSlug:'a-letter-to-god',                        weekAgo:2, accuracy:93, level:'expert',   attempts:15, practiceCount:15, masteryFloat:0.93 },
    { sSlug:'english-language', cSlug:'first-flight-literature',tSlug:'nelson-mandela-long-walk-to-freedom',    weekAgo:2, accuracy:91, level:'expert',   attempts:14, practiceCount:14, masteryFloat:0.91 },
    { sSlug:'english-language', cSlug:'grammar-and-writing-skills', tSlug:'tenses-and-sentence-transformation', weekAgo:1, accuracy:92, level:'expert',   attempts:14, practiceCount:14, masteryFloat:0.92 },
    { sSlug:'english-language', cSlug:'grammar-and-writing-skills', tSlug:'formal-letter-writing',              weekAgo:0, accuracy:93, level:'expert',   attempts:13, practiceCount:13, masteryFloat:0.93 },
  ],
  // ── Ravi (mixed: Math strong 80-88%, Science weak 35-60%, SocSci moderate 65-73%) ──
  ravi: [
    { sSlug:'mathematics', cSlug:'real-numbers',                tSlug:'euclids-division-lemma',                 weekAgo:6, accuracy:80, level:'advanced',     attempts:16, practiceCount:16, masteryFloat:0.80 },
    { sSlug:'mathematics', cSlug:'real-numbers',                tSlug:'fundamental-theorem-of-arithmetic',      weekAgo:5, accuracy:82, level:'advanced',     attempts:15, practiceCount:15, masteryFloat:0.82 },
    { sSlug:'mathematics', cSlug:'pair-of-linear-equations',    tSlug:'graphical-method-of-solution',           weekAgo:4, accuracy:85, level:'advanced',     attempts:14, practiceCount:14, masteryFloat:0.85 },
    { sSlug:'mathematics', cSlug:'pair-of-linear-equations',    tSlug:'algebraic-methods-substitution-elimination', weekAgo:3, accuracy:87, level:'advanced', attempts:13, practiceCount:13, masteryFloat:0.87 },
    { sSlug:'science', cSlug:'electricity',                     tSlug:'electric-current-and-circuit',           weekAgo:8, accuracy:35, level:'beginner',     attempts:8,  practiceCount:8,  masteryFloat:0.35 },
    { sSlug:'science', cSlug:'electricity',                     tSlug:'ohms-law-and-resistance',                weekAgo:7, accuracy:44, level:'beginner',     attempts:9,  practiceCount:9,  masteryFloat:0.44 },
    { sSlug:'science', cSlug:'chemical-reactions-and-equations',tSlug:'types-of-chemical-reactions',            weekAgo:6, accuracy:56, level:'intermediate', attempts:10, practiceCount:10, masteryFloat:0.56 },
    { sSlug:'science', cSlug:'chemical-reactions-and-equations',tSlug:'balancing-chemical-equations',           weekAgo:5, accuracy:60, level:'intermediate', attempts:9,  practiceCount:9,  masteryFloat:0.60 },
    { sSlug:'social-science', cSlug:'nationalism-in-india',     tSlug:'non-cooperation-movement',               weekAgo:4, accuracy:65, level:'intermediate', attempts:9,  practiceCount:9,  masteryFloat:0.65 },
    { sSlug:'social-science', cSlug:'nationalism-in-india',     tSlug:'civil-disobedience-movement',            weekAgo:3, accuracy:68, level:'intermediate', attempts:8,  practiceCount:8,  masteryFloat:0.68 },
    { sSlug:'social-science', cSlug:'resources-and-development',tSlug:'types-of-resources',                     weekAgo:2, accuracy:70, level:'intermediate', attempts:8,  practiceCount:8,  masteryFloat:0.70 },
    { sSlug:'social-science', cSlug:'resources-and-development',tSlug:'land-use-pattern-in-india',              weekAgo:1, accuracy:73, level:'intermediate', attempts:7,  practiceCount:7,  masteryFloat:0.73 },
  ],
};

// ── Student config ─────────────────────────────────────────────────────────
const STUDENTS = [
  {
    email: 'arjun.sharma@test10.cbse', name: 'Arjun Sharma',
    key: 'arjun', label: 'Struggling',
    board: 'cbse', grade: '10', language: 'en', timezone: 'Asia/Kolkata',
    subjects: ['Science', 'Mathematics', 'Social Science'],
    dailyTargetMin: 30, studyDaysPerWeek: 4,
    currentStreak: 3, longestStreak: 7,
    totalSessions: 6, learningPoints: 180,
    weakSubjects: ['Science', 'Social Science'],
  },
  {
    email: 'priya.patel@test10.cbse',  name: 'Priya Patel',
    key: 'priya', label: 'High Achiever',
    board: 'cbse', grade: '10', language: 'en', timezone: 'Asia/Kolkata',
    subjects: ['Science', 'Mathematics', 'Social Science', 'English Language'],
    dailyTargetMin: 60, studyDaysPerWeek: 6,
    currentStreak: 15, longestStreak: 21,
    totalSessions: 22, learningPoints: 860,
    weakSubjects: [],
  },
  {
    email: 'ravi.kumar@test10.cbse',   name: 'Ravi Kumar',
    key: 'ravi', label: 'Mixed Performer',
    board: 'cbse', grade: '10', language: 'en', timezone: 'Asia/Kolkata',
    subjects: ['Mathematics', 'Science', 'Social Science'],
    dailyTargetMin: 45, studyDaysPerWeek: 5,
    currentStreak: 7, longestStreak: 12,
    totalSessions: 14, learningPoints: 430,
    weakSubjects: ['Science'],
  },
];

const PARENTS = [
  { email: 'kavita.sharma@parent.test', name: 'Kavita Sharma', studentKey: 'arjun' },
  { email: 'suresh.patel@parent.test',  name: 'Suresh Patel',  studentKey: 'priya' },
];

// ============================================================================
// SEED FUNCTIONS
// ============================================================================

async function upsertUser(cfg) {
  return prisma.user.upsert({
    where: { email: cfg.email },
    update: { name: cfg.name, language: cfg.language, board: cfg.board, grade: cfg.grade, subjects: cfg.subjects, timezone: cfg.timezone },
    create: { email: cfg.email, name: cfg.name, language: cfg.language, board: cfg.board, grade: cfg.grade, subjects: cfg.subjects, timezone: cfg.timezone },
  });
}

// ── Engagement (streak + stats) ───────────────────────────────────────────────
async function seedEngagement(studentId, cfg) {
  await prisma.studentEngagementStats.upsert({
    where: { studentId },
    update: { currentStreak: cfg.currentStreak, longestStreak: cfg.longestStreak, lastActiveDate: daysAgo(0), totalSessionsCompleted: cfg.totalSessions, learningPoints: cfg.learningPoints },
    create: { studentId, currentStreak: cfg.currentStreak, longestStreak: cfg.longestStreak, lastActiveDate: daysAgo(0), totalSessionsCompleted: cfg.totalSessions, learningPoints: cfg.learningPoints },
  });
  // StudentStreak has no unique on (studentId,kind) - use findFirst + update/create
  const existing = await prisma.studentStreak.findFirst({ where: { studentId, kind: 'daily' } });
  if (existing) {
    await prisma.studentStreak.update({ where: { id: existing.id }, data: { current: cfg.currentStreak, best: cfg.longestStreak, lastActive: daysAgo(0) } });
  } else {
    await prisma.studentStreak.create({ data: { studentId, kind: 'daily', current: cfg.currentStreak, best: cfg.longestStreak, lastActive: daysAgo(0) } });
  }
}

// ── Learning profile ──────────────────────────────────────────────────────────
async function seedLearningProfile(studentId, cfg) {
  await prisma.studentLearningProfile.upsert({
    where: { studentId },
    update: { dailyTargetMin: cfg.dailyTargetMin, studyDaysPerWeek: cfg.studyDaysPerWeek, weakSubjects: cfg.weakSubjects, recommendations: { generatedAt: NOW.toISOString() } },
    create: { studentId, dailyTargetMin: cfg.dailyTargetMin, studyDaysPerWeek: cfg.studyDaysPerWeek, weakSubjects: cfg.weakSubjects, recommendations: { generatedAt: NOW.toISOString() } },
  });
}

// ── Topic mastery (with historical updatedAt backfill for 8-week trend) ───────
async function seedMastery(studentId, key, topicMap) {
  const plan = MASTERY_PLAN[key] || [];
  let seeded = 0;
  for (const row of plan) {
    const topic = (topicMap[row.sSlug] || {})[row.cSlug]?.[row.tSlug];
    if (!topic) { warn(`  Topic not found: ${row.sSlug}/${row.cSlug}/${row.tSlug}`); continue; }

    const targetDate = weeksAgo(row.weekAgo);

    // StudentTopicMastery
    const stm = await prisma.studentTopicMastery.upsert({
      where: { studentId_topicId: { studentId, topicId: topic.id } },
      update: { accuracy: row.accuracy, questionsAttempted: row.attempts, masteryLevel: row.level, lastAttemptedAt: targetDate },
      create: { studentId, topicId: topic.id, subject: row.sSlug.replace(/-/g,' '), chapter: row.cSlug.replace(/-/g,' '), accuracy: row.accuracy, questionsAttempted: row.attempts, masteryLevel: row.level, lastAttemptedAt: targetDate },
    });
    // Backfill updatedAt so the 8-week trend chart has spread-out data points
    await prisma.$executeRaw`UPDATE "StudentTopicMastery" SET "updatedAt" = ${targetDate} WHERE "id" = ${stm.id}`;

    // StudentTopicProgress
    await prisma.studentTopicProgress.upsert({
      where: { studentId_topicId: { studentId, topicId: topic.id } },
      update: { mastery: row.masteryFloat, practiceCount: row.practiceCount, lastStudiedAt: targetDate },
      create: { studentId, topicId: topic.id, mastery: row.masteryFloat, practiceCount: row.practiceCount, lastStudiedAt: targetDate },
    });

    seeded++;
  }
  return seeded;
}

// ── Structured sessions ───────────────────────────────────────────────────────
// Sessions config: includes CURRENT WEEK sessions so ParentWeeklyActivity renders
const SESSION_PLANS = {
  arjun: [
    // Past completed sessions (spread across previous weeks for weekly-strip history)
    { tPath:['science','electricity','electric-current-and-circuit'],   state:'COMPLETE', startOffset:daysAgo(10), durationMin:35 },
    { tPath:['science','electricity','ohms-law-and-resistance'],         state:'COMPLETE', startOffset:daysAgo(8),  durationMin:40 },
    { tPath:['mathematics','real-numbers','euclids-division-lemma'],     state:'COMPLETE', startOffset:daysAgo(6),  durationMin:38 },
    { tPath:['social-science','nationalism-in-india','non-cooperation-movement'], state:'COMPLETE', startOffset:daysAgo(4), durationMin:32 },
    { tPath:['mathematics','pair-of-linear-equations','graphical-method-of-solution'], state:'COMPLETE', startOffset:daysAgo(3), durationMin:42 },
    // Current-week completed (needed for ParentWeeklyActivity.studyMinutes)
    { tPath:['mathematics','real-numbers','fundamental-theorem-of-arithmetic'], state:'COMPLETE', startOffset:daysAgo(1), durationMin:35 },
    // Active session → P1 resume CTA on PrimaryActionCard
    { tPath:['science','chemical-reactions-and-equations','types-of-chemical-reactions'], state:'PRACTICE', startOffset:hoursAgo(2), durationMin:null },
    // Expired session (old, no completedAt)
    { tPath:['social-science','nationalism-in-india','civil-disobedience-movement'], state:'EXPIRED', startOffset:daysAgo(18), durationMin:null },
  ],
  priya: [
    { tPath:['science','electricity','electric-current-and-circuit'],   state:'COMPLETE', startOffset:daysAgo(14), durationMin:45 },
    { tPath:['science','electricity','ohms-law-and-resistance'],         state:'COMPLETE', startOffset:daysAgo(12), durationMin:48 },
    { tPath:['mathematics','real-numbers','euclids-division-lemma'],     state:'COMPLETE', startOffset:daysAgo(10), durationMin:42 },
    { tPath:['mathematics','real-numbers','fundamental-theorem-of-arithmetic'], state:'COMPLETE', startOffset:daysAgo(8), durationMin:50 },
    { tPath:['social-science','nationalism-in-india','non-cooperation-movement'], state:'COMPLETE', startOffset:daysAgo(6), durationMin:40 },
    { tPath:['social-science','nationalism-in-india','civil-disobedience-movement'], state:'COMPLETE', startOffset:daysAgo(5), durationMin:45 },
    { tPath:['english-language','first-flight-literature','a-letter-to-god'], state:'COMPLETE', startOffset:daysAgo(4), durationMin:38 },
    { tPath:['english-language','first-flight-literature','nelson-mandela-long-walk-to-freedom'], state:'COMPLETE', startOffset:daysAgo(3), durationMin:42 },
    // Current-week completed (2 sessions → ParentWeeklyActivity shows data)
    { tPath:['english-language','grammar-and-writing-skills','tenses-and-sentence-transformation'], state:'COMPLETE', startOffset:daysAgo(1), durationMin:45 },
    { tPath:['social-science','resources-and-development','types-of-resources'], state:'COMPLETE', startOffset:hoursAgo(3), durationMin:40 },
    // Active HOMEWORK session → PrimaryActionCard "resume homework"
    { tPath:['english-language','grammar-and-writing-skills','formal-letter-writing'], state:'HOMEWORK', startOffset:hoursAgo(1), durationMin:null },
  ],
  ravi: [
    { tPath:['mathematics','real-numbers','euclids-division-lemma'],     state:'COMPLETE', startOffset:daysAgo(12), durationMin:40 },
    { tPath:['mathematics','real-numbers','fundamental-theorem-of-arithmetic'], state:'COMPLETE', startOffset:daysAgo(9), durationMin:42 },
    { tPath:['mathematics','pair-of-linear-equations','graphical-method-of-solution'], state:'COMPLETE', startOffset:daysAgo(7), durationMin:38 },
    { tPath:['mathematics','pair-of-linear-equations','algebraic-methods-substitution-elimination'], state:'COMPLETE', startOffset:daysAgo(5), durationMin:44 },
    { tPath:['social-science','nationalism-in-india','non-cooperation-movement'], state:'COMPLETE', startOffset:daysAgo(4), durationMin:36 },
    // Last completed session = 3 days ago → daysSinceLastSession=3 → NudgeBanner triggers
    { tPath:['science','electricity','electric-current-and-circuit'],   state:'COMPLETE', startOffset:daysAgo(3), durationMin:30 },
    // Current-week session (1 session in this week for ParentWeeklyActivity)
    { tPath:['social-science','resources-and-development','types-of-resources'], state:'COMPLETE', startOffset:daysAgo(1), durationMin:35 },
    // Active PRACTICE session (started today)
    { tPath:['science','electricity','ohms-law-and-resistance'], state:'PRACTICE', startOffset:hoursAgo(1), durationMin:null },
  ],
};

async function seedSessions(studentId, key, topicMap) {
  const plan = SESSION_PLANS[key] || [];
  const created = [];
  for (const sc of plan) {
    const [sSlug, cSlug, tSlug] = sc.tPath;
    const topic = (topicMap[sSlug] || {})[cSlug]?.[tSlug];
    if (!topic) { warn(`Session topic not found: ${sc.tPath.join('/')}`); continue; }

    const startedAt  = sc.startOffset;
    const completedAt = sc.durationMin ? addMinutes(startedAt, sc.durationMin) : null;

    const session = await prisma.structuredSession.create({
      data: { studentId, topicId: topic.id, state: sc.state, startedAt, completedAt, meta: { seed: true, key } },
    });

    if (sc.state === 'COMPLETE') {
      await prisma.sessionEvent.createMany({ skipDuplicates: true, data: [
        { sessionId: session.id, eventType: 'SESSION_STARTED',        timestamp: startedAt },
        { sessionId: session.id, eventType: 'SESSION_OVERVIEW_VIEWED', timestamp: addMinutes(startedAt, 1) },
        { sessionId: session.id, eventType: 'PHASE_STARTED',          timestamp: addMinutes(startedAt, 3),  metadata: { phase: 'EXPLANATION' } },
        { sessionId: session.id, eventType: 'QUESTION_ANSWERED',      timestamp: addMinutes(startedAt, sc.durationMin - 10), metadata: { correct: true, score: 80 } },
        { sessionId: session.id, eventType: 'SESSION_COMPLETED',      timestamp: completedAt, metadata: { totalScore: 80 } },
      ]});
    }
    created.push(session);
  }
  return created;
}

// ── Homework assignments ──────────────────────────────────────────────────────
// P0 trigger: HomeworkAssignment WHERE status IN(PENDING,OVERDUE) AND dueDate <= NOW+48h
const HOMEWORK_PLANS = {
  arjun: [
    // P0: overdue (dueDate in past) → PrimaryActionCard = homework (BLOCKED until done)
    { tPath:['science','electricity','electric-current-and-circuit'],   status:'OVERDUE',   dueDate:daysAgo(3),        score:null },
    { tPath:['social-science','nationalism-in-india','non-cooperation-movement'], status:'OVERDUE', dueDate:daysAgo(7), score:null },
    // Urgent pending (dueDate within 24 h) - also P0 candidate
    { tPath:['mathematics','real-numbers','euclids-division-lemma'],     status:'PENDING',   dueDate:hoursFromNow(20),  score:null },
  ],
  priya: [
    { tPath:['science','electricity','electric-current-and-circuit'],   status:'GRADED',    dueDate:daysAgo(12), score:92 },
    { tPath:['mathematics','real-numbers','euclids-division-lemma'],     status:'GRADED',    dueDate:daysAgo(8),  score:88 },
    { tPath:['social-science','nationalism-in-india','non-cooperation-movement'], status:'SUBMITTED', dueDate:daysAgo(2), score:null },
    // Upcoming pending (dueDate tomorrow)
    { tPath:['english-language','grammar-and-writing-skills','formal-letter-writing'], status:'PENDING', dueDate:hoursFromNow(30), score:null },
  ],
  ravi: [
    { tPath:['mathematics','real-numbers','euclids-division-lemma'],     status:'GRADED',    dueDate:daysAgo(8),  score:74 },
    { tPath:['science','electricity','electric-current-and-circuit'],   status:'SUBMITTED', dueDate:daysAgo(2),  score:null },
    // Urgent pending due in 36 h → P0
    { tPath:['social-science','nationalism-in-india','non-cooperation-movement'], status:'PENDING', dueDate:hoursFromNow(36), score:null },
  ],
};

const HW_QUESTIONS = [
  { id: 'hwq1', text: 'Explain the concept in your own words. (5 marks)', type: 'short_answer', marks: 5 },
  { id: 'hwq2', text: 'Choose the correct option:', type: 'mcq', options: ['Option A', 'Option B', 'Option C', 'Option D'], answer: 'Option A', marks: 2 },
  { id: 'hwq3', text: 'Solve the given problem step by step. (3 marks)', type: 'short_answer', marks: 3 },
];

async function seedHomework(studentId, key, topicMap) {
  const plan = HOMEWORK_PLANS[key] || [];
  for (const hw of plan) {
    const [sSlug, cSlug, tSlug] = hw.tPath;
    const topic = (topicMap[sSlug] || {})[cSlug]?.[tSlug];
    if (!topic) { warn(`HW topic not found: ${hw.tPath.join('/')}`); continue; }

    const assignment = await prisma.homeworkAssignment.create({
      data: { studentId, topicId: topic.id, questions: HW_QUESTIONS, status: hw.status, dueDate: hw.dueDate, score: hw.score },
    });

    if (hw.status === 'SUBMITTED' || hw.status === 'GRADED') {
      await prisma.homeworkAnswer.createMany({ skipDuplicates: true, data: [
        { assignmentId: assignment.id, questionId: 'hwq1', studentAnswer: { text: 'This concept involves the fundamental principles as explained in the notes.' }, isCorrect: true },
        { assignmentId: assignment.id, questionId: 'hwq2', studentAnswer: { selected: 'Option A' }, isCorrect: true },
        { assignmentId: assignment.id, questionId: 'hwq3', studentAnswer: { text: 'Step 1: Identify. Step 2: Apply formula. Step 3: Calculate result.' }, isCorrect: hw.score ? hw.score > 70 : null },
      ]});
    }
  }
}

// ── Content catalog (recommendation engine candidates) ────────────────────────
const CATALOG_ENTRIES = [
  { contentId:'cat:sci:electricity:notes',    title:'Electricity - Study Notes',           description:'Complete notes on electric current, Ohm\'s law and circuits.', type:'notes',    subject:'Science',        board:'cbse', grade:'10', language:'en', difficulty:'medium', tags:['electricity','circuits','current'] },
  { contentId:'cat:sci:chemistry:practice',   title:'Chemical Reactions - Practice Set',   description:'50 practice problems on types of reactions and balancing.', type:'practice', subject:'Science',        board:'cbse', grade:'10', language:'en', difficulty:'medium', tags:['chemistry','reactions','equations'] },
  { contentId:'cat:math:realnumbers:notes',   title:'Real Numbers - Concept Guide',        description:'Visual guide to Euclid\'s lemma and prime factorisation.', type:'notes',    subject:'Mathematics',    board:'cbse', grade:'10', language:'en', difficulty:'easy',   tags:['real numbers','HCF','LCM'] },
  { contentId:'cat:math:linearequations:test',title:'Linear Equations - Quick Test',       description:'15-minute test on graphical and algebraic methods.', type:'test',     subject:'Mathematics',    board:'cbse', grade:'10', language:'en', difficulty:'medium', tags:['linear equations','substitution','elimination'] },
  { contentId:'cat:socSci:nationalism:notes', title:'Nationalism in India - Timeline',     description:'Illustrated timeline of Non-Cooperation and Civil Disobedience.', type:'notes', subject:'Social Science', board:'cbse', grade:'10', language:'en', difficulty:'easy',   tags:['nationalism','Gandhi','independence'] },
  { contentId:'cat:socSci:resources:practice',title:'Resources - Classification Practice', description:'Classify resources by origin, exhaustibility and ownership.', type:'practice', subject:'Social Science', board:'cbse', grade:'10', language:'en', difficulty:'easy',   tags:['resources','land use','environment'] },
  { contentId:'cat:eng:literature:notes',     title:'First Flight - Story Analysis',       description:'Theme and character analysis for Letter to God and Mandela.', type:'notes',    subject:'English Language', board:'cbse', grade:'10', language:'en', difficulty:'easy',   tags:['literature','comprehension','themes'] },
  { contentId:'cat:eng:grammar:practice',     title:'Grammar Booster - Tenses & Voice',   description:'100 transformation exercises: tenses, active/passive, reported speech.', type:'practice', subject:'English Language', board:'cbse', grade:'10', language:'en', difficulty:'medium', tags:['grammar','tenses','voice','letter writing'] },
];

async function seedContentCatalog() {
  let added = 0;
  for (const entry of CATALOG_ENTRIES) {
    await prisma.contentCatalog.upsert({
      where: { contentId: entry.contentId },
      update: { active: true },
      create: entry,
    });
    added++;
  }
  return added;
}

// ── Content recommendations ───────────────────────────────────────────────────
const REC_PLANS = {
  arjun: [
    { contentId:'cat:sci:electricity:notes',    isShown:true, isClicked:false, isIgnored:false, firstShownAt:daysAgo(1) },
    { contentId:'cat:socSci:nationalism:notes', isShown:true, isClicked:true,  isIgnored:false, firstShownAt:daysAgo(2), clickedAt:daysAgo(2) },
    { contentId:'cat:math:realnumbers:notes',   isShown:true, isClicked:false, isIgnored:true,  firstShownAt:daysAgo(3), ignoredAt:daysAgo(3) },
  ],
  priya: [
    { contentId:'cat:eng:literature:notes',     isShown:true, isClicked:true,  isCompleted:true,  firstShownAt:daysAgo(5), clickedAt:daysAgo(5), completedAt:daysAgo(4) },
    { contentId:'cat:math:linearequations:test',isShown:true, isClicked:true,  isCompleted:true,  firstShownAt:daysAgo(3), clickedAt:daysAgo(3), completedAt:daysAgo(2) },
    { contentId:'cat:socSci:resources:practice',isShown:true, isClicked:false, isIgnored:true,   firstShownAt:daysAgo(1), ignoredAt:hoursAgo(6) },
  ],
  ravi: [
    { contentId:'cat:sci:electricity:notes',    isShown:true, isClicked:true,  isCompleted:false, firstShownAt:daysAgo(4), clickedAt:daysAgo(4) },
    { contentId:'cat:socSci:nationalism:notes', isShown:true, isClicked:false, isIgnored:false,  firstShownAt:daysAgo(2) },
    { contentId:'cat:math:realnumbers:notes',   isShown:true, isClicked:true,  isCompleted:true,  firstShownAt:daysAgo(6), clickedAt:daysAgo(6), completedAt:daysAgo(5) },
  ],
};

async function seedRecommendations(studentId, key) {
  for (const rec of (REC_PLANS[key] || [])) {
    await prisma.contentRecommendation.upsert({
      where: { userId_contentId: { userId: studentId, contentId: rec.contentId } },
      update: {},
      create: {
        userId: studentId, contentId: rec.contentId,
        isShown: rec.isShown || false, isClicked: rec.isClicked || false,
        isCompleted: rec.isCompleted || false, isIgnored: rec.isIgnored || false,
        firstShownAt: rec.firstShownAt || null, lastShownAt: rec.firstShownAt || null,
        clickedAt: rec.clickedAt || null, completedAt: rec.completedAt || null,
        ignoredAt: rec.ignoredAt || null,
      },
    });
  }
}

// ── Recommendation trace (observability/admin debugging) ─────────────────────
async function seedRecommendationTrace(studentId, key) {
  const traces = [
    { contentId: 'cat:sci:electricity:notes',    entityType: 'notes',    score: 72.5, signals: { WEAK_SUBJECT_BOOST: 25, PROFILE_MATCH: 30, FRESHNESS: 5, ENGAGEMENT_HISTORY: -10 } },
    { contentId: 'cat:socSci:nationalism:notes', entityType: 'notes',    score: 65.0, signals: { WEAK_SUBJECT_BOOST: 25, LOW_SCORE_CHAPTER: 20, FRESHNESS: 5, DIFFICULTY_MATCH: 10 } },
    { contentId: 'cat:math:realnumbers:notes',   entityType: 'practice', score: 45.0, signals: { PROFILE_MATCH: 30, FRESHNESS: 5, DIFFICULTY_MATCH: 10 } },
  ];
  for (const t of traces) {
    await prisma.recommendationTrace.create({
      data: { studentId, entityType: t.entityType, entityId: t.contentId, score: t.score, signals: t.signals, engineVersion: 'seed-v2' },
    });
  }
}

// ── Daily tasks ───────────────────────────────────────────────────────────────
const DAILY_TASK_PLANS = {
  arjun: { taskType: 'practice', title: 'Practice: Ohm\'s Law Problems',     description: 'Solve 5 numerical problems on V=IR and resistivity to strengthen your weak topic.',  subject: 'Science',   estimatedTimeMin: 20, status: 'pending',   motivationMessage: null },
  priya: { taskType: 'learn',    title: 'Learn: Formal Letter Writing',       description: 'Study the 8-part letter format and attempt one letter to the school principal.',     subject: 'English Language', estimatedTimeMin: 30, status: 'completed', motivationMessage: 'Excellent work! Letter structure mastered.' },
  ravi:  { taskType: 'fix_gap',  title: 'Fix gap: Electric Current Concepts', description: 'Your mastery on Electric Current is at 35%. Re-read the note and attempt the easy test.', subject: 'Science', estimatedTimeMin: 25, status: 'pending',   motivationMessage: null },
};

async function seedDailyTask(studentId, key, topicMap) {
  const cfg = DAILY_TASK_PLANS[key];
  if (!cfg) return;
  const todayMidnight = new Date(NOW); todayMidnight.setUTCHours(0,0,0,0);
  // Find a relevant topicId
  let topicId = null;
  if (key === 'arjun') topicId = topicMap['science']?.['electricity']?.['ohms-law-and-resistance']?.id ?? null;
  if (key === 'priya') topicId = topicMap['english-language']?.['grammar-and-writing-skills']?.['formal-letter-writing']?.id ?? null;
  if (key === 'ravi')  topicId = topicMap['science']?.['electricity']?.['electric-current-and-circuit']?.id ?? null;

  await prisma.dailyTask.upsert({
    where: { studentId_date: { studentId, date: todayMidnight } },
    update: { status: cfg.status, completedAt: cfg.status === 'completed' ? hoursAgo(2) : null },
    create: {
      studentId, date: todayMidnight, taskType: cfg.taskType, title: cfg.title,
      description: cfg.description, topicId, subject: cfg.subject,
      estimatedTimeMin: cfg.estimatedTimeMin, status: cfg.status,
      completedAt: cfg.status === 'completed' ? hoursAgo(2) : null,
      motivationMessage: cfg.motivationMessage,
    },
  });
}

// ── Attention flags ───────────────────────────────────────────────────────────
async function seedAttentionFlags(studentId, key, topicMap) {
  const flagDefs = {
    arjun: [
      { sSlug:'science', cSlug:'electricity', tSlug:'electric-current-and-circuit', accuracy:34, level:'beginner', reason:'low_mastery' },
      { sSlug:'science', cSlug:'electricity', tSlug:'ohms-law-and-resistance', accuracy:37, level:'beginner', reason:'low_mastery' },
      { sSlug:'social-science', cSlug:'nationalism-in-india', tSlug:'non-cooperation-movement', accuracy:30, level:'beginner', reason:'low_mastery' },
    ],
    ravi: [
      { sSlug:'science', cSlug:'electricity', tSlug:'electric-current-and-circuit', accuracy:35, level:'beginner', reason:'low_mastery' },
    ],
    priya: [],
  };
  for (const fd of (flagDefs[key] || [])) {
    const topic = (topicMap[fd.sSlug] || {})[fd.cSlug]?.[fd.tSlug];
    if (!topic) continue;
    await prisma.attentionFlag.upsert({
      where: { studentId_topicId: { studentId, topicId: topic.id } },
      update: { accuracy: fd.accuracy, masteryLevel: fd.level, reason: fd.reason, resolved: false },
      create: { studentId, topicId: topic.id, subject: fd.sSlug, chapter: fd.cSlug, masteryLevel: fd.level, accuracy: fd.accuracy, reason: fd.reason },
    });
  }
}

// ── Readiness status ──────────────────────────────────────────────────────────
const READINESS_PLAN = {
  arjun: [
    { subject:'Science',        board:'cbse', topicsCovered:4, totalTopics:4, coveragePercent:100, avgMastery:0.38, readinessScore:38, readinessLabel:'needs_work' },
    { subject:'Mathematics',    board:'cbse', topicsCovered:4, totalTopics:4, coveragePercent:100, avgMastery:0.66, readinessScore:66, readinessLabel:'on_track' },
    { subject:'Social Science', board:'cbse', topicsCovered:4, totalTopics:4, coveragePercent:100, avgMastery:0.34, readinessScore:34, readinessLabel:'needs_work' },
  ],
  priya: [
    { subject:'Science',          board:'cbse', topicsCovered:4, totalTopics:4, coveragePercent:100, avgMastery:0.87, readinessScore:87, readinessLabel:'ready' },
    { subject:'Mathematics',      board:'cbse', topicsCovered:4, totalTopics:4, coveragePercent:100, avgMastery:0.90, readinessScore:90, readinessLabel:'ready' },
    { subject:'Social Science',   board:'cbse', topicsCovered:4, totalTopics:4, coveragePercent:100, avgMastery:0.90, readinessScore:90, readinessLabel:'ready' },
    { subject:'English Language', board:'cbse', topicsCovered:4, totalTopics:4, coveragePercent:100, avgMastery:0.92, readinessScore:92, readinessLabel:'ready' },
  ],
  ravi: [
    { subject:'Mathematics',    board:'cbse', topicsCovered:4, totalTopics:4, coveragePercent:100, avgMastery:0.84, readinessScore:84, readinessLabel:'ready' },
    { subject:'Science',        board:'cbse', topicsCovered:4, totalTopics:4, coveragePercent:100, avgMastery:0.49, readinessScore:49, readinessLabel:'needs_work' },
    { subject:'Social Science', board:'cbse', topicsCovered:4, totalTopics:4, coveragePercent:100, avgMastery:0.69, readinessScore:69, readinessLabel:'on_track' },
  ],
};

async function seedReadinessStatus(studentId, key) {
  for (const r of (READINESS_PLAN[key] || [])) {
    await prisma.readinessStatus.upsert({
      where: { studentId_subject: { studentId, subject: r.subject } },
      update: r,
      create: { studentId, ...r },
    });
  }
}

// ── Legacy learning sessions (P1 fallback in getNextAction) ───────────────────
async function seedLegacySessions(studentId, key) {
  // Only seed for students that don't have a StructuredSession active
  // Ravi: add one incomplete legacy session (for P1 detection if structured session misses)
  if (key !== 'ravi') return;
  const existing = await prisma.learningSession.findFirst({ where: { studentId, isCompleted: false } });
  if (existing) return;
  await prisma.learningSession.create({
    data: { studentId, activityType: 'practice', activityRef: 'science-electricity-practice', difficultyLevel: 'medium', isCompleted: false, completionPercentage: 40, startedAt: hoursAgo(4), lastAccessed: hoursAgo(1), estimatedTimeMinutes: 30, actualTimeSpent: 12 },
  });
}

// ── Weekly summaries ──────────────────────────────────────────────────────────
const WEEKLY_SUMMARY_PLANS = {
  arjun: [
    { wk:8, topics:1, tests:2, avgScore:42, minutes:35, sessions:2, subjects:['Science'] },
    { wk:7, topics:1, tests:2, avgScore:44, minutes:40, sessions:2, subjects:['Science','Social Science'] },
    { wk:6, topics:2, tests:3, avgScore:46, minutes:50, sessions:3, subjects:['Science','Social Science'] },
    { wk:5, topics:2, tests:3, avgScore:48, minutes:55, sessions:3, subjects:['Science','Mathematics'] },
    { wk:4, topics:2, tests:3, avgScore:55, minutes:60, sessions:3, subjects:['Mathematics'] },
    { wk:3, topics:2, tests:3, avgScore:58, minutes:65, sessions:3, subjects:['Mathematics'] },
    { wk:2, topics:2, tests:3, avgScore:60, minutes:60, sessions:3, subjects:['Mathematics','Science'] },
    { wk:1, topics:2, tests:3, avgScore:62, minutes:70, sessions:3, subjects:['Mathematics','Social Science'] },
    { wk:0, topics:1, tests:2, avgScore:55, minutes:35, sessions:2, subjects:['Mathematics'] },
  ],
  priya: [
    { wk:8, topics:3, tests:5, avgScore:84, minutes:200, sessions:5, subjects:['Science','Mathematics'] },
    { wk:7, topics:4, tests:6, avgScore:86, minutes:225, sessions:6, subjects:['Science','Mathematics','Social Science'] },
    { wk:6, topics:3, tests:5, avgScore:87, minutes:195, sessions:5, subjects:['Mathematics','Social Science'] },
    { wk:5, topics:4, tests:7, avgScore:89, minutes:250, sessions:6, subjects:['Mathematics','Social Science','English Language'] },
    { wk:4, topics:3, tests:6, avgScore:90, minutes:220, sessions:6, subjects:['Social Science','English Language'] },
    { wk:3, topics:4, tests:7, avgScore:91, minutes:265, sessions:7, subjects:['Social Science','English Language'] },
    { wk:2, topics:3, tests:6, avgScore:92, minutes:240, sessions:6, subjects:['English Language','Science'] },
    { wk:1, topics:4, tests:7, avgScore:93, minutes:270, sessions:7, subjects:['English Language','Mathematics'] },
    { wk:0, topics:2, tests:4, avgScore:92, minutes:130, sessions:4, subjects:['English Language','Social Science'] },
  ],
  ravi: [
    { wk:8, topics:2, tests:3, avgScore:58, minutes:80,  sessions:3, subjects:['Science'] },
    { wk:7, topics:2, tests:3, avgScore:62, minutes:90,  sessions:3, subjects:['Science','Mathematics'] },
    { wk:6, topics:3, tests:4, avgScore:68, minutes:110, sessions:4, subjects:['Mathematics'] },
    { wk:5, topics:2, tests:4, avgScore:70, minutes:115, sessions:4, subjects:['Mathematics','Science'] },
    { wk:4, topics:3, tests:5, avgScore:73, minutes:125, sessions:5, subjects:['Mathematics','Social Science'] },
    { wk:3, topics:3, tests:5, avgScore:75, minutes:130, sessions:5, subjects:['Mathematics','Social Science'] },
    { wk:2, topics:3, tests:5, avgScore:77, minutes:130, sessions:5, subjects:['Social Science','Mathematics'] },
    { wk:1, topics:2, tests:4, avgScore:75, minutes:110, sessions:4, subjects:['Social Science','Science'] },
    { wk:0, topics:1, tests:2, avgScore:72, minutes:65,  sessions:2, subjects:['Social Science'] },
  ],
};

async function seedWeeklySummaries(studentId, key) {
  for (const s of (WEEKLY_SUMMARY_PLANS[key] || [])) {
    const ws = isoWeekStart(weeksAgo(s.wk));
    await prisma.weeklyStudentSummary.upsert({
      where: { studentId_weekStart: { studentId, weekStart: ws } },
      update: { topicsCovered: s.topics, testsTaken: s.tests, averageScore: s.avgScore, totalMinutes: s.minutes, sessionsCount: s.sessions, subjectsActive: s.subjects },
      create: { studentId, weekStart: ws, topicsCovered: s.topics, testsTaken: s.tests, averageScore: s.avgScore, totalMinutes: s.minutes, sessionsCount: s.sessions, subjectsActive: s.subjects },
    });
  }
}

// ── Subject progress summaries ────────────────────────────────────────────────
const SUBJECT_SUMMARY_PLAN = {
  arjun: [
    { subject:'Science',        board:'cbse', totalTopics:4, topicsCovered:4, averageMastery:0.38, strongTopics:0, weakTopics:4 },
    { subject:'Mathematics',    board:'cbse', totalTopics:4, topicsCovered:4, averageMastery:0.66, strongTopics:2, weakTopics:0 },
    { subject:'Social Science', board:'cbse', totalTopics:4, topicsCovered:4, averageMastery:0.34, strongTopics:0, weakTopics:4 },
  ],
  priya: [
    { subject:'Science',          board:'cbse', totalTopics:4, topicsCovered:4, averageMastery:0.87, strongTopics:4, weakTopics:0 },
    { subject:'Mathematics',      board:'cbse', totalTopics:4, topicsCovered:4, averageMastery:0.90, strongTopics:4, weakTopics:0 },
    { subject:'Social Science',   board:'cbse', totalTopics:4, topicsCovered:4, averageMastery:0.90, strongTopics:4, weakTopics:0 },
    { subject:'English Language', board:'cbse', totalTopics:4, topicsCovered:4, averageMastery:0.92, strongTopics:4, weakTopics:0 },
  ],
  ravi: [
    { subject:'Mathematics',    board:'cbse', totalTopics:4, topicsCovered:4, averageMastery:0.84, strongTopics:4, weakTopics:0 },
    { subject:'Science',        board:'cbse', totalTopics:4, topicsCovered:4, averageMastery:0.49, strongTopics:0, weakTopics:2 },
    { subject:'Social Science', board:'cbse', totalTopics:4, topicsCovered:4, averageMastery:0.69, strongTopics:1, weakTopics:0 },
  ],
};

async function seedSubjectSummaries(studentId, key) {
  for (const s of (SUBJECT_SUMMARY_PLAN[key] || [])) {
    await prisma.subjectProgressSummary.upsert({
      where: { studentId_subject: { studentId, subject: s.subject } },
      update: s,
      create: { studentId, ...s },
    });
  }
}

// ── Parents ────────────────────────────────────────────────────────────────────
async function seedParents(studentIdByKey) {
  const results = [];
  for (const p of PARENTS) {
    const parent = await prisma.user.upsert({
      where: { email: p.email },
      update: { name: p.name },
      create: { email: p.email, name: p.name, language: 'en' },
    });
    const studentId = studentIdByKey[p.studentKey];
    if (!studentId) { warn(`Parent ${p.name}: student key '${p.studentKey}' not found`); continue; }
    await prisma.parentStudent.upsert({
      where: { parentId_studentId: { parentId: parent.id, studentId } },
      update: { status: 'active' },
      create: { parentId: parent.id, studentId, status: 'active' },
    });
    results.push(p);
  }
  return results;
}

// ============================================================================
// VALIDATION
// ============================================================================

async function runValidations(studentIds) {
  // ── curriculum ─────────────────────────────────────────────────────────────
  const topicCount = await prisma.topicDef.count({ where: { status: 'approved', lifecycle: 'active' } });
  topicCount >= 16 ? pass(`Curriculum: ${topicCount} approved active topics (16 expected)`) : warn(`Curriculum: only ${topicCount} approved topics -- need ≥16`);

  const noteCount = await prisma.topicNote.count({ where: { status: 'approved', language: 'en' } });
  noteCount >= 16 ? pass(`TopicNote: ${noteCount} approved English notes`) : warn(`TopicNote: only ${noteCount} -- need ≥16`);

  // ── student core ────────────────────────────────────────────────────────────
  const engStats  = await prisma.studentEngagementStats.count({ where: { studentId: { in: studentIds } } });
  engStats === 3   ? pass('StudentEngagementStats: all 3 students') : warn(`StudentEngagementStats: ${engStats}/3`);

  const streaks   = await prisma.studentStreak.count({ where: { studentId: { in: studentIds }, kind: 'daily' } });
  streaks >= 3    ? pass('StudentStreak (daily): all students') : warn(`StudentStreak: ${streaks}/3`);

  const profiles  = await prisma.studentLearningProfile.count({ where: { studentId: { in: studentIds } } });
  profiles === 3  ? pass('StudentLearningProfile: all 3 students') : warn(`StudentLearningProfile: ${profiles}/3`);

  // ── mastery ─────────────────────────────────────────────────────────────────
  const stmCount  = await prisma.studentTopicMastery.count({ where: { studentId: { in: studentIds } } });
  stmCount >= 28  ? pass(`StudentTopicMastery: ${stmCount} records (covers 8-week trend)`) : warn(`StudentTopicMastery: only ${stmCount} records`);

  const stpCount  = await prisma.studentTopicProgress.count({ where: { studentId: { in: studentIds } } });
  stpCount >= 28  ? pass(`StudentTopicProgress: ${stpCount} records`) : warn(`StudentTopicProgress: only ${stpCount}`);

  // ── weak topics (student dashboard gate: mastery < 0.4) ────────────────────
  const weakStp = await prisma.studentTopicProgress.count({ where: { studentId: { in: studentIds }, mastery: { lt: 0.4 } } });
  weakStp >= 5  ? pass(`Weak topics (mastery<0.4): ${weakStp} rows -- WeakTopicsSection will render for Arjun + Ravi`)
               : warn(`Weak topics (mastery<0.4): only ${weakStp} -- WeakTopicsSection may be hidden`);

  // ── parent weak topics (mastery < 0.4 AND practiceCount > 5) ───────────────
  const parentWeak = await prisma.studentTopicProgress.count({ where: { studentId: { in: studentIds }, mastery: { lt: 0.4 }, practiceCount: { gt: 5 } } });
  parentWeak >= 4  ? pass(`Parent weak topics (mastery<0.4, practiceCount>5): ${parentWeak} -- ParentWeakTopics card will render`)
                  : warn(`Parent weak topics: only ${parentWeak} -- ParentWeakTopics card needs mastery<0.4 AND practiceCount>5`);

  // ── 8-week trend spread (StudentTopicMastery.updatedAt across 8 weeks) ──────
  const eightWeeksAgo = weeksAgo(8);
  const trendCoverage = await prisma.studentTopicMastery.count({ where: { studentId: { in: studentIds }, updatedAt: { gte: eightWeeksAgo } } });
  trendCoverage >= 20 ? pass(`STM updatedAt spread: ${trendCoverage} rows within last 8 weeks (ParentImprovementTrend)`)
                      : warn(`STM updatedAt spread: only ${trendCoverage} rows in last 8 weeks`);

  // ── sessions ────────────────────────────────────────────────────────────────
  const totalSess  = await prisma.structuredSession.count({ where: { studentId: { in: studentIds } } });
  totalSess >= 15  ? pass(`StructuredSession: ${totalSess} total`) : warn(`StructuredSession: only ${totalSess}`);

  const completedS = await prisma.structuredSession.count({ where: { studentId: { in: studentIds }, state: 'COMPLETE' } });
  completedS >= 12 ? pass(`COMPLETE sessions: ${completedS}`) : warn(`COMPLETE sessions: only ${completedS}`);

  const activeSess = await prisma.structuredSession.count({ where: { studentId: { in: studentIds }, state: { notIn: ['COMPLETE','EXPIRED'] } } });
  activeSess >= 3  ? pass(`Active (in-progress) sessions: ${activeSess} -- PrimaryActionCard resume CTAs ready`) : warn(`Active sessions: only ${activeSess}`);

  const expiredS   = await prisma.structuredSession.count({ where: { studentId: { in: studentIds }, state: 'EXPIRED' } });
  expiredS >= 1    ? pass(`EXPIRED sessions: ${expiredS}`) : warn('No EXPIRED sessions');

  // ── current-week sessions (ParentWeeklyActivity.studyMinutes) ───────────────
  const thisWeekMon = isoWeekStart(NOW);
  const thisWeekSun = new Date(thisWeekMon.getTime() + 7 * 86400000 - 1);
  const thisWeekSess = await prisma.structuredSession.count({
    where: { studentId: { in: studentIds }, state: 'COMPLETE', startedAt: { gte: thisWeekMon, lte: thisWeekSun }, completedAt: { not: null } },
  });
  thisWeekSess >= 3 ? pass(`Current-week completed sessions: ${thisWeekSess} (with completedAt → studyMinutes will be non-zero)`)
                    : warn(`Current-week sessions: only ${thisWeekSess} -- ParentWeeklyActivity may show 0 minutes`);

  // ── session events ──────────────────────────────────────────────────────────
  const events = await prisma.sessionEvent.count({ where: { session: { studentId: { in: studentIds } } } });
  events >= 30  ? pass(`SessionEvent: ${events} events`) : warn(`SessionEvent: only ${events}`);

  // ── homework ─────────────────────────────────────────────────────────────────
  const hwPending = await prisma.homeworkAssignment.count({ where: { studentId: { in: studentIds }, status: 'PENDING' } });
  const hwOverdue = await prisma.homeworkAssignment.count({ where: { studentId: { in: studentIds }, status: 'OVERDUE' } });
  const hwSubmit  = await prisma.homeworkAssignment.count({ where: { studentId: { in: studentIds }, status: 'SUBMITTED' } });
  const hwGraded  = await prisma.homeworkAssignment.count({ where: { studentId: { in: studentIds }, status: 'GRADED' } });
  hwPending >= 2 ? pass(`PENDING homework: ${hwPending}`) : warn(`PENDING homework: only ${hwPending}`);
  hwOverdue >= 2 ? pass(`OVERDUE homework: ${hwOverdue} -- HomeworkPendingCard will show (red)`) : warn(`OVERDUE homework: only ${hwOverdue}`);
  hwSubmit >= 1  ? pass(`SUBMITTED homework: ${hwSubmit}`) : warn(`SUBMITTED homework: none`);
  hwGraded >= 2  ? pass(`GRADED homework: ${hwGraded}`) : warn(`GRADED homework: only ${hwGraded}`);

  // ── P0 homework trigger (dueDate ≤ NOW+48h) ─────────────────────────────────
  const p0hw = await prisma.homeworkAssignment.count({
    where: { studentId: { in: studentIds }, status: { in: ['PENDING','OVERDUE'] }, dueDate: { lte: hoursFromNow(48) } },
  });
  p0hw >= 2 ? pass(`P0 homework (due ≤ 48h): ${p0hw} -- PrimaryActionCard will show URGENT homework CTA`)
            : warn(`P0 homework trigger: only ${p0hw} -- check dueDate values`);

  // ── recommendations ──────────────────────────────────────────────────────────
  const catalog = await prisma.contentCatalog.count({ where: { active: true, board: 'cbse', grade: '10' } });
  catalog >= 8   ? pass(`ContentCatalog: ${catalog} active CBSE Grade 10 entries`) : warn(`ContentCatalog: only ${catalog}`);

  const recs     = await prisma.contentRecommendation.count({ where: { userId: { in: studentIds } } });
  recs >= 6      ? pass(`ContentRecommendation: ${recs} records (shown/clicked/completed/ignored states)`) : warn(`ContentRecommendation: only ${recs}`);

  const traces   = await prisma.recommendationTrace.count({ where: { studentId: { in: studentIds } } });
  traces >= 3    ? pass(`RecommendationTrace: ${traces} audit rows`) : warn(`RecommendationTrace: none`);

  // ── daily tasks ───────────────────────────────────────────────────────────────
  const dailyTasks = await prisma.dailyTask.count({ where: { studentId: { in: studentIds } } });
  dailyTasks >= 3  ? pass(`DailyTask: ${dailyTasks} tasks seeded (today)`) : warn(`DailyTask: only ${dailyTasks}`);

  // ── attention flags ────────────────────────────────────────────────────────────
  const flags    = await prisma.attentionFlag.count({ where: { studentId: { in: studentIds }, resolved: false } });
  flags >= 3     ? pass(`AttentionFlag: ${flags} unresolved low-mastery flags`) : warn(`AttentionFlag: only ${flags}`);

  // ── readiness status ───────────────────────────────────────────────────────────
  const readiness = await prisma.readinessStatus.count({ where: { studentId: { in: studentIds } } });
  readiness >= 8  ? pass(`ReadinessStatus: ${readiness} subject readiness records`) : warn(`ReadinessStatus: only ${readiness}`);

  // ── weekly summaries ────────────────────────────────────────────────────────────
  const weeklySumm = await prisma.weeklyStudentSummary.count({ where: { studentId: { in: studentIds } } });
  weeklySumm >= 20 ? pass(`WeeklyStudentSummary: ${weeklySumm} rows (8-week parent trend coverage)`)
                   : warn(`WeeklyStudentSummary: only ${weeklySumm} -- trend chart may be sparse`);

  // ── subject summaries ────────────────────────────────────────────────────────────
  const subjSumm = await prisma.subjectProgressSummary.count({ where: { studentId: { in: studentIds } } });
  subjSumm >= 10  ? pass(`SubjectProgressSummary: ${subjSumm} rows (ParentSubjectMastery card)`)
                 : warn(`SubjectProgressSummary: only ${subjSumm}`);

  // ── parent links ────────────────────────────────────────────────────────────────
  const pLinks  = await prisma.parentStudent.count({ where: { studentId: { in: studentIds }, status: 'active' } });
  pLinks >= 2   ? pass(`ParentStudent links (active): ${pLinks}`) : warn(`ParentStudent active links: only ${pLinks}`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║   seed-dashboard-test-data  v2   CBSE · Grade 10 · English      ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');

  if (DRY_RUN) { console.log('[DRY RUN] No DB writes.\n'); printReport({}); return; }

  // ── Step 1: Curriculum ──────────────────────────────────────────────────────
  console.log('▶ Step 1: Extending curriculum (Social Science + English Language)');
  const { board, classLevel, map: topicMap } = await fetchTopicMap();
  const cStats = await seedCurriculum(classLevel);
  console.log(`  ✓ +${cStats.subjects} subjects, +${cStats.chapters} chapters, +${cStats.topics} topics`);
  console.log(`  ✓ +${cStats.notes} notes, +${cStats.tests} tests, +${cStats.questions} questions\n`);

  // Refresh map after curriculum seed
  const { map: freshMap } = await fetchTopicMap();

  // ── Step 2: Content catalog ────────────────────────────────────────────────
  console.log('▶ Step 2: Seeding ContentCatalog (recommendation engine candidates)');
  const catCount = await seedContentCatalog();
  console.log(`  ✓ ${catCount} catalog entries upserted\n`);

  // ── Step 3: Students ───────────────────────────────────────────────────────
  console.log('▶ Step 3: Creating 3 student profiles\n');
  const studentIdByKey = {};
  const studentIds     = [];

  for (const cfg of STUDENTS) {
    console.log(`  ── ${cfg.name} (${cfg.label}) ─────────────────────────`);
    const user = await upsertUser(cfg);
    studentIdByKey[cfg.key] = user.id;
    studentIds.push(user.id);

    await seedLearningProfile(user.id, cfg);
    console.log(`     ✓ LearningProfile  target=${cfg.dailyTargetMin}min/day, ${cfg.studyDaysPerWeek}d/wk, weak=[${cfg.weakSubjects.join(', ')||'none'}]`);

    await seedEngagement(user.id, cfg);
    console.log(`     ✓ Streak           current=${cfg.currentStreak}d best=${cfg.longestStreak}d points=${cfg.learningPoints}`);

    const masteryCount = await seedMastery(user.id, cfg.key, freshMap);
    console.log(`     ✓ TopicMastery     ${masteryCount} topics seeded (updatedAt backfilled across 8 weeks)`);

    const sessions = await seedSessions(user.id, cfg.key, freshMap);
    const comp = sessions.filter(s => s.state === 'COMPLETE').length;
    const active = sessions.filter(s => !['COMPLETE','EXPIRED'].includes(s.state)).length;
    const expired = sessions.filter(s => s.state === 'EXPIRED').length;
    console.log(`     ✓ Sessions         ${sessions.length} total (${comp} COMPLETE, ${active} active, ${expired} EXPIRED)`);

    await seedHomework(user.id, cfg.key, freshMap);
    console.log(`     ✓ Homework         seeded (PENDING/OVERDUE/SUBMITTED/GRADED)`);

    await seedRecommendations(user.id, cfg.key);
    console.log(`     ✓ Recommendations  ContentRecommendation records seeded`);

    await seedRecommendationTrace(user.id, cfg.key);
    console.log(`     ✓ RecTrace         audit trail seeded`);

    await seedDailyTask(user.id, cfg.key, freshMap);
    console.log(`     ✓ DailyTask        today's task seeded`);

    await seedAttentionFlags(user.id, cfg.key, freshMap);
    console.log(`     ✓ AttentionFlags   low-mastery flags seeded`);

    await seedReadinessStatus(user.id, cfg.key);
    console.log(`     ✓ ReadinessStatus  per-subject readiness seeded`);

    await seedLegacySessions(user.id, cfg.key);
    await seedWeeklySummaries(user.id, cfg.key);
    console.log(`     ✓ WeeklySummaries  9 weeks of parent-view data`);

    await seedSubjectSummaries(user.id, cfg.key);
    console.log(`     ✓ SubjectSummary   per-subject snapshot seeded\n`);

    REPORT.students[cfg.email] = { name: cfg.name, label: cfg.label, id: user.id, key: cfg.key };
  }

  // ── Step 4: Parents ────────────────────────────────────────────────────────
  console.log('▶ Step 4: Creating parent accounts');
  const parents = await seedParents(studentIdByKey);
  for (const p of parents) console.log(`  ✓ ${p.name} (${p.email}) → ${p.studentKey}`);
  console.log('');

  // ── Step 5: Validations ────────────────────────────────────────────────────
  console.log('▶ Step 5: Running dashboard layer validations');
  await runValidations(studentIds);
  const passes = REPORT.passes.length;
  const warns  = REPORT.warnings.length;
  for (const v of REPORT.passes)   console.log(`  ✓ ${v}`);
  for (const w of REPORT.warnings) console.log(`  ⚠  ${w}`);
  console.log(`\n  Result: ${passes} PASS  ${warns} WARN\n`);

  printReport(studentIdByKey);
}

// ============================================================================
// ACTIONABLE REPORT
// ============================================================================

function printReport(studentIdByKey) {
  const HR = '─'.repeat(72);
  const line = (s = '') => console.log(s);
  const h1   = (s) => { line(); console.log(`  ${s}`); console.log(`  ${'─'.repeat(s.length)}`); };

  line();
  console.log('╔═══════════════════════════════════════════════════════════════════════╗');
  console.log('║            SEED REPORT  -  CBSE Grade 10  Complete Journey          ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════╝');

  h1('CURRICULUM SEEDED');
  line('  4 Subjects × 2 Chapters × 2 Topics = 16 topics');
  line('  Each topic: 1 approved TopicNote (en) + 3 GeneratedTests (easy/medium/hard)');
  line();
  line('  Science        - Electricity (2 topics) · Chemical Reactions (2 topics)');
  line('  Mathematics    - Real Numbers (2 topics) · Pair of Linear Equations (2 topics)');
  line('  Social Science - Nationalism in India (2) · Resources & Development (2)');
  line('  English Lang.  - First Flight Literature (2) · Grammar & Writing (2)');

  h1('TEST STUDENTS');
  line();
  line('  1. Arjun Sharma   arjun.sharma@test10.cbse   [Struggling]');
  line('     Subjects: Science · Mathematics · Social Science');
  line('     Mastery:  Science≈37% (beginner) | Math≈66% (intermediate) | SocSci≈34% (beginner)');
  line('     Streak:   3 days current  /  7 days best  /  180 pts');
  line('     Sessions: 6 COMPLETE · 1 PRACTICE (active → resume CTA) · 1 EXPIRED');
  line('     Homework: 2 OVERDUE (past due) · 1 PENDING (due in 20h → P0 urgent)');
  line('     DailyTask: "Practice: Ohm\'s Law Problems" [pending]');
  line('     Readiness: Science=needs_work(38) · Math=on_track(66) · SocSci=needs_work(34)');
  line();
  line('  2. Priya Patel    priya.patel@test10.cbse    [High Achiever]');
  line('     Subjects: Science · Mathematics · Social Science · English Language');
  line('     Mastery:  Science≈86% · Math≈90% · SocSci≈90% · English≈92% (advanced/expert)');
  line('     Streak:   15 days current  /  21 days best  /  860 pts');
  line('     Sessions: 10 COMPLETE (8 weeks history) · 1 HOMEWORK (active → resume HW)');
  line('     Homework: 2 GRADED · 1 SUBMITTED · 1 PENDING (due in 30h)');
  line('     DailyTask: "Learn: Formal Letter Writing" [completed ✓]');
  line('     Readiness: all subjects = ready (87-92)');
  line();
  line('  3. Ravi Kumar     ravi.kumar@test10.cbse     [Mixed Performer]');
  line('     Subjects: Mathematics · Science · Social Science');
  line('     Mastery:  Math≈84% (advanced) · Science≈49% (mixed) · SocSci≈69% (intermediate)');
  line('     Streak:   7 days current  /  12 days best  /  430 pts');
  line('     Sessions: 7 COMPLETE · 1 PRACTICE (active today) · last-complete = 3 days ago');
  line('     Homework: 1 GRADED · 1 SUBMITTED · 1 PENDING (due in 36h → P0 urgent)');
  line('     DailyTask: "Fix gap: Electric Current Concepts" [pending]');
  line('     NudgeBanner: daysSinceLastSession=3 → "return to platform" nudge will fire');
  line('     Readiness: Math=ready(84) · Science=needs_work(49) · SocSci=on_track(69)');

  h1('PARENT ACCOUNTS');
  line();
  line('  kavita.sharma@parent.test  →  Arjun Sharma  (parent sees overdue HW, weak Science + SocSci)');
  line('  suresh.patel@parent.test   →  Priya Patel   (parent sees upward 8-week trend 84%→93%)');

  h1('DASHBOARD LAYER COVERAGE');
  line();
  line('  ┌─ STUDENT DASHBOARD ─────────────────────────────────────────────────┐');
  line('  │ Component              Arjun         Priya         Ravi             │');
  line('  │ EngagementSection      streak=3d ✓   streak=15d ✓  streak=7d ✓      │');
  line('  │ PrimaryActionCard      P0 OVERDUE HW P1 resume HW  P0 PENDING HW    │');
  line('  │ WeeklyStudyStrip       partial week  full week ✓   partial week      │');
  line('  │ HomeworkPendingCard    3 items ✓     hidden        1 item ✓         │');
  line('  │ WeakTopicsSection      5 topics ✓    hidden        1 topic ✓        │');
  line('  │ UpcomingTopicsList     uncovered ✓   new topics ✓  uncovered ✓      │');
  line('  │ NudgeBanner            homework nudge goal nudge    return nudge ✓   │');
  line('  │ DailyTask badge        pending ✓     completed ✓   pending ✓        │');
  line('  └─────────────────────────────────────────────────────────────────────┘');
  line();
  line('  ┌─ PARENT DASHBOARD ──────────────────────────────────────────────────┐');
  line('  │ Component              Kavita(→Arjun)            Suresh(→Priya)     │');
  line('  │ ParentWeeklyActivity   sessions + studyMinutes ✓  sessions + min ✓  │');
  line('  │ ParentSubjectMastery   3 subjects, low avg ✓      4 subjects, high ✓│');
  line('  │ ParentWeakTopics       5 topics (<0.4) ✓          none (empty card) │');
  line('  │ ParentImprovementTrend 8-week mixed trend ✓       8-week rise 84→93 │');
  line('  └─────────────────────────────────────────────────────────────────────┘');
  line();
  line('  ┌─ PROGRESS / MASTERY INTELLIGENCE ───────────────────────────────────┐');
  line('  │ StudentTopicMastery    accuracy% + masteryLevel per topic           │');
  line('  │ StudentTopicProgress   mastery float 0-1 + practiceCount            │');
  line('  │ STM.updatedAt spread   8 distinct ISO weeks → trend chart has data  │');
  line('  │ AttentionFlag          Arjun: 3 flags · Ravi: 1 flag                │');
  line('  │ ReadinessStatus        per-subject needs_work/on_track/ready        │');
  line('  └─────────────────────────────────────────────────────────────────────┘');
  line();
  line('  ┌─ RECOMMENDATION ENGINE ─────────────────────────────────────────────┐');
  line('  │ ContentCatalog         8 active CBSE G10 entries (notes/practice)   │');
  line('  │ ContentRecommendation  shown/clicked/completed/ignored states × 3   │');
  line('  │ RecommendationTrace    scoring audit trail seeded                   │');
  line('  │ WEAK_SUBJECT_BOOST     Arjun: Science+SocSci boosted                │');
  line('  │ RESUME_SESSION         All 3: active sessions → +50 score           │');
  line('  └─────────────────────────────────────────────────────────────────────┘');
  line();
  line('  ┌─ SESSIONS & HOMEWORK ───────────────────────────────────────────────┐');
  line('  │ StructuredSession      COMPLETE(13) · PRACTICE(2) · HOMEWORK(1) ·  │');
  line('  │                        EXPIRED(1) · this-week completedAt ✓         │');
  line('  │ SessionEvent           5 events per completed session               │');
  line('  │ HomeworkAssignment     PENDING(3) · OVERDUE(2) · SUBMITTED(2) ·    │');
  line('  │                        GRADED(3) · P0 trigger (dueDate ≤ NOW+48h)   │');
  line('  │ LearningSession        Ravi: legacy session (P1 fallback)           │');
  line('  └─────────────────────────────────────────────────────────────────────┘');

  h1('HOW TO TEST EACH DASHBOARD');
  line();
  line('  1. Start dev server');
  line('       npm run dev');
  line();
  line('  2. Log in as each student (use magic-link or set passwordHash via Prisma Studio)');
  line('       Arjun  → /dashboard   expects: HomeworkPendingCard + WeakTopicsSection visible');
  line('       Priya  → /dashboard   expects: EngagementSection (streak=15) + active HOMEWORK CTA');
  line('       Ravi   → /dashboard   expects: NudgeBanner (return nudge) + WeakTopicsSection');
  line();
  line('  3. Log in as parent');
  line('       Kavita → /parent/dashboard   expects: weak topics list + low accuracy bars');
  line('       Suresh → /parent/dashboard   expects: 8-week upward trend chart 84%→93%');
  line();
  line('  4. Recommendation API smoke tests');
  line('       GET /api/recommendations?userId=<arjun-id>');
  line('           → ≥ 2 items, Science/SocSci topics should rank highest (WEAK_SUBJECT_BOOST)');
  line('       GET /api/recommendations?userId=<priya-id>');
  line('           → advanced/expert level content, English next topic recommended');
  line('       GET /api/recommendations?userId=<ravi-id>');
  line('           → Science weak topic + RESUME_SESSION signal for active PRACTICE session');
  line();
  line('  5. Prisma Studio for full data inspection');
  line('       npx prisma studio');
  line();
  line('  6. Parent API smoke tests');
  line('       GET /api/parent/weekly-activity?studentId=<arjun-id>   → studyMinutes > 0');
  line('       GET /api/parent/subject-mastery?studentId=<arjun-id>   → 3 subjects, low accuracy');
  line('       GET /api/parent/weak-topics?studentId=<arjun-id>       → 5 weak topics (mastery<0.4)');
  line('       GET /api/parent/improvement-trend?studentId=<priya-id> → 8 weeks, rising accuracy');

  if (REPORT.warnings.length > 0) {
    h1('WARNINGS');
    for (const w of REPORT.warnings) line(`  ⚠  ${w}`);
  }

  h1('NEXT STEPS IF ANYTHING IS MISSING');
  line();
  line('  Prerequisite seed order:');
  line('    1. node scripts/seed-taxonomy.cjs          # board + class hierarchy');
  line('    3. node scripts/seed-dashboard-test-data.cjs  # this script');
  line();
  line('  Full reset:');
  line('    npx prisma migrate reset --force   then re-run all three in order');
  line();
  line('  Dry-run (shows plan without DB writes):');
  line('    node scripts/seed-dashboard-test-data.cjs --dry-run');
  line();
  console.log('  Script:  scripts/seed-dashboard-test-data.cjs');
  console.log('  Branch:  claude/seed-dashboard-test-data-CNWd7');
  line();
}

// ── entry ─────────────────────────────────────────────────────────────────────
main()
  .catch(err => { console.error('\n[FATAL]', err); process.exit(1); })
  .finally(async () => { if (prisma) await prisma.$disconnect(); });
