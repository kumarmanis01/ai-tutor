/**
 * seed-dashboard-test-data.cjs
 *
 * Comprehensive seed for testing all dashboard layers in CBSE Grade 10.
 *
 * Extends seed-ai-data.cjs (Science + Mathematics) with:
 *   + Social Science  (History + Geography chapters)
 *   + English Language (Literature + Grammar chapters)
 *
 * Creates 3 students with diverse learning profiles:
 *   1. Arjun Sharma  (arjun.sharma@test10.cbse)  – Struggling student
 *   2. Priya Patel   (priya.patel@test10.cbse)   – High achiever
 *   3. Ravi Kumar    (ravi.kumar@test10.cbse)     – Mixed performer
 *
 * Creates 2 parent accounts linked to students:
 *   - kavita.sharma@parent.test  → Arjun's parent
 *   - suresh.patel@parent.test   → Priya's parent
 *
 * Dashboard layers exercised:
 *   ✓ Student Dashboard  – streak, engagement, weak topics, homework, upcoming, recommendations
 *   ✓ Parent Dashboard   – weekly activity, subject mastery, weak topics, improvement trend
 *   ✓ Progress/Mastery   – StudentTopicMastery, StudentTopicProgress, StudentEngagementStats
 *   ✓ Sessions           – StructuredSession (COMPLETE / active / EXPIRED) + SessionEvents
 *   ✓ Homework           – PENDING, OVERDUE, SUBMITTED, GRADED assignments
 *   ✓ Recommendations    – ContentRecommendation (shown / clicked / completed / ignored)
 *   ✓ Weekly summaries   – WeeklyStudentSummary (8 weeks), SubjectProgressSummary
 *
 * Usage:
 *   node scripts/seed-dashboard-test-data.cjs
 *   node scripts/seed-dashboard-test-data.cjs --dry-run
 *
 * Prerequisite: board + class hierarchy must exist (run seed-ai-content first,
 * or run seed-ai-data.cjs which also re-seeds Science + Mathematics content).
 *
 * Idempotent: uses upsert / skipDuplicates throughout.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── env loader ───────────────────────────────────────────────────────────────
function loadEnv() {
  const root = path.resolve(__dirname, '..');
  for (const name of ['.env.local', '.env']) {
    const p = path.join(root, name);
    if (!fs.existsSync(p)) continue;
    for (let line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      line = line.trim();
      if (!line || line.startsWith('#')) continue;
      const m = line.match(/^([^=\s]+)=((?:".*")|(?:'.*')|.*)$/);
      if (!m) continue;
      let val = m[2];
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = val;
    }
    console.log(`[env] loaded ${p}`);
    break;
  }
}
loadEnv();

const DRY_RUN = process.argv.includes('--dry-run');
let prisma = null;
if (!DRY_RUN) {
  const { PrismaClient } = require('@prisma/client');
  prisma = new PrismaClient();
}

// ── date helpers ─────────────────────────────────────────────────────────────
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function weeksAgo(n) { return daysAgo(n * 7); }
function hoursAgo(n) {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d;
}
// Monday midnight UTC for a given date
function weekStart(date) {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day);
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// ── report collector ─────────────────────────────────────────────────────────
const report = {
  curriculum: {},
  students: {},
  validations: [],
  warnings: [],
};
function pass(label) { report.validations.push({ status: 'PASS', label }); }
function warn(label) { report.warnings.push({ status: 'WARN', label }); }

// ============================================================================
// CURRICULUM DATA  (4 subjects × 2 chapters × 2 topics)
// ============================================================================

const BOARD_SLUG  = 'cbse';
const GRADE       = 10;

// Note-builder (same schema as seed-ai-data.cjs)
function buildNote(title, intro, sections, keyTerms, examples) {
  return {
    introduction: intro,
    learningObjectives: sections.map(s => s.keyTakeaway || `Understand ${s.heading}`),
    sections,
    keyTerms,
    realWorldExamples: examples,
    commonMistakes: [
      { mistake: 'Memorising without understanding.', correction: 'Focus on the "why" behind each concept.' },
      { mistake: 'Skipping units / context in answers.', correction: 'Always state the unit or context of your answer.' },
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

// Question bank – 2 per difficulty per topic
function questionsForTopic(topicName) {
  return {
    easy: [
      { type: 'mcq',          question: `Which of the following best describes ${topicName}?`, options: ['A core concept in this chapter', 'An advanced college topic', 'Outside the CBSE syllabus', 'Unrelated to this subject'], answer: 'A core concept in this chapter', explanation: `${topicName} is a fundamental CBSE Grade 10 concept.`, marks: 1 },
      { type: 'short_answer', question: `Define ${topicName} in two sentences.`, options: null, answer: `${topicName} is a key topic in the CBSE Class 10 curriculum.`, explanation: 'A definition should state the core idea and its scope.', marks: 2 },
    ],
    medium: [
      { type: 'mcq',          question: `Which principle directly applies when analysing ${topicName}?`, options: ['The primary principle of this topic', "Newton's 3rd law", "Archimedes' principle", "Boyle's law"], answer: 'The primary principle of this topic', explanation: `The core rule of ${topicName} is most applicable here.`, marks: 2 },
      { type: 'short_answer', question: `Explain, with an example, how ${topicName} is applied.`, options: null, answer: `Apply the core concept of ${topicName} with a worked example.`, explanation: 'Application questions test deeper understanding.', marks: 3 },
    ],
    hard: [
      { type: 'mcq',          question: `In a complex scenario involving ${topicName}, changing initial conditions leads to:`, options: ['A proportional change in the result', 'No change', 'A zero result', 'An unpredictable outcome'], answer: 'A proportional change in the result', explanation: `Proportional reasoning is central to mastering ${topicName}.`, marks: 3 },
      { type: 'short_answer', question: `Compare two approaches for solving problems in ${topicName}. Which is more efficient?`, options: null, answer: 'Analyse trade-offs: accuracy, speed, and applicability for each approach.', explanation: 'Higher-order questions require evaluation skills.', marks: 4 },
    ],
  };
}

const EXTRA_SUBJECTS = [
  // ── Social Science ──────────────────────────────────────────────────────
  {
    name: 'Social Science',
    slug: 'social-science',
    chapters: [
      {
        name: 'Nationalism in India',
        slug: 'nationalism-in-india',
        order: 1,
        topics: [
          {
            name: 'Non-Cooperation Movement',
            slug: 'non-cooperation-movement',
            order: 1,
            note: buildNote(
              'Non-Cooperation Movement',
              'The Non-Cooperation Movement (1920-22), led by Mahatma Gandhi, was the first mass movement that united Indians across regions and communities to resist British rule by refusing to cooperate with colonial institutions.',
              [
                { heading: 'Origins and Launch', explanation: 'Triggered by the Jallianwala Bagh massacre (1919) and Khilafat grievances, Gandhi proposed non-cooperation in the Nagpur session of the Indian National Congress (December 1920). Indians were asked to surrender titles, boycott civil services, army, police, courts, and legislative councils, and to refuse to attend government-aided schools.', keyTakeaway: 'Non-cooperation = withdrawal from all British institutions + swadeshi.' },
                { heading: 'Spread and Withdrawal', explanation: 'The movement spread to towns (lawyers boycotted courts) and villages (peasants refused to pay taxes). It was called off after the Chauri Chaura incident (February 1922), where a crowd burned a police station killing 22 policemen. Gandhi believed satyagrahis were not yet ready for mass civil disobedience.', keyTakeaway: 'Chauri Chaura incident → suspension of movement; satyagraha must be non-violent.' },
              ],
              [
                { term: 'Satyagraha', definition: 'Truth-force; resistance through non-violent means.', example: 'Gandhi used satyagraha in South Africa before bringing it to India.' },
                { term: 'Khilafat Issue', definition: "Muslims' concern over the Ottoman Caliph after WWI; used by Gandhi to build Hindu-Muslim unity.", example: 'Congress supported the Khilafat Committee in 1919.' },
              ],
              [{ scenario: 'Students boycotting government schools during Non-Cooperation.', connection: 'This forced the British to recognise the scale of Indian resistance and showed ordinary people could challenge colonial authority.' }]
            ),
          },
          {
            name: 'Civil Disobedience Movement',
            slug: 'civil-disobedience-movement',
            order: 2,
            note: buildNote(
              'Civil Disobedience Movement',
              'The Civil Disobedience Movement (1930-34) began with the historic Dandi March, in which Gandhi walked 240 miles to make salt from seawater, defying the British salt tax and igniting mass civil disobedience across India.',
              [
                { heading: 'Dandi March and Salt Satyagraha', explanation: 'On 12 March 1930, Gandhi set out from Sabarmati Ashram with 78 followers, reaching Dandi on 6 April where he made salt illegally. This symbolic act captured global attention. Across India, people broke the salt law, boycotted foreign cloth and liquor, and refused to pay revenue taxes. Women participated in large numbers for the first time.', keyTakeaway: 'Dandi March → salt as symbol of colonial exploitation → mass civil disobedience.' },
                { heading: 'Gandhi–Irwin Pact and Aftermath', explanation: 'In March 1931, Gandhi signed the Gandhi-Irwin Pact: the government agreed to release political prisoners and allow salt collection on the coast. In return, Congress agreed to participate in the Round Table Conference. However, the second conference (London, 1931) was unsuccessful and civil disobedience resumed in 1932 before being formally withdrawn in 1934.', keyTakeaway: 'Gandhi–Irwin Pact = temporary truce; movement resumed 1932, withdrawn 1934.' },
              ],
              [
                { term: 'Civil Disobedience', definition: 'Deliberate, non-violent refusal to obey specific unjust laws.', example: 'Breaking the salt law was civil disobedience because it openly challenged a specific colonial regulation.' },
                { term: 'Dandi March', definition: '240-mile march to the sea led by Gandhi in March-April 1930 to protest the salt tax.', example: 'The march lasted 24 days and triggered nationwide satyagraha.' },
              ],
              [{ scenario: 'Comparing Non-Cooperation (1920) and Civil Disobedience (1930).', connection: 'CDM directly broke specific laws (salt tax), while NCM focused on withdrawal; CDM had greater mass participation and international visibility.' }]
            ),
          },
        ],
      },
      {
        name: 'Resources and Development',
        slug: 'resources-and-development',
        order: 2,
        topics: [
          {
            name: 'Types of Resources',
            slug: 'types-of-resources',
            order: 1,
            note: buildNote(
              'Types of Resources',
              'Resources are everything available in our environment that can be used to satisfy our needs. They are classified on the basis of origin, exhaustibility, ownership, and status of development.',
              [
                { heading: 'Classification by Origin and Exhaustibility', explanation: 'By origin: biotic (obtained from living organisms, e.g., forests, fish) and abiotic (non-living, e.g., rocks, metals). By exhaustibility: renewable (can be replenished naturally, e.g., solar energy, water) and non-renewable (formed over millions of years, e.g., fossil fuels, minerals — consumed faster than formed).', keyTakeaway: 'Renewable ↔ replenishable; Non-renewable ↔ finite and exhaustible.' },
                { heading: 'Classification by Ownership and Development', explanation: 'By ownership: individual (privately owned land, water bodies), community (grazing grounds, cremation grounds), national (rivers, forests within national territory), international (oceanic resources beyond 200 nautical miles — governed by international institutions). By status of development: potential (not yet exploited), developed (surveyed, quality/quantity determined), stock (available but lacking technology to access), reserves (subset of stock usable with current tech).', keyTakeaway: 'Know four ownership types and four development-status types.' },
              ],
              [
                { term: 'Biotic Resources', definition: 'Resources obtained from the biosphere (living component of the environment).', example: 'Forests, animals, fish, birds, and human beings.' },
                { term: 'Non-renewable Resources', definition: 'Resources that cannot be replenished once used up, formed over geological time.', example: 'Coal, petroleum, natural gas.' },
              ],
              [{ scenario: "India's coal reserves are depleting rapidly due to industrial use.", connection: 'Coal is a non-renewable, abiotic, national resource. Once exhausted it cannot be renewed; this drives the push for renewable (solar/wind) alternatives.' }]
            ),
          },
          {
            name: 'Land Use Pattern in India',
            slug: 'land-use-pattern-in-india',
            order: 2,
            note: buildNote(
              'Land Use Pattern in India',
              'Land use refers to the purpose for which land is used by people. In India, land use data is collected by the government through the Survey of India and is reported in seven categories.',
              [
                { heading: 'Categories of Land Use', explanation: 'The seven categories are: (1) Forests, (2) Land not available for cultivation (barren/wastelands, land used for non-agricultural purposes), (3) Other uncultivated land (permanent pastures, miscellaneous tree crops, culturable wasteland), (4) Fallow lands (current fallow + other fallow), (5) Net sown area. Forest area in India (≈23%) is well below the National Forest Policy target of 33%.', keyTakeaway: 'Net sown area + fallow = gross cropped area. Forests cover ~23% vs 33% target.' },
                { heading: 'Factors Affecting Land Use', explanation: 'Physical factors: topography, climate, soil type. Human factors: population density, technology, and cultural traditions. Degradation threats: soil erosion, water-logging, salinisation, desertification. Conservation methods: crop rotation, contour ploughing, terrace farming, shelter belts.', keyTakeaway: 'Degradation causes (erosion, waterlogging) + conservation methods (rotation, terracing).' },
              ],
              [
                { term: 'Net Sown Area', definition: 'The area sown with crops at least once in a year.', example: 'Punjab has the highest net sown area as percentage of total area in India.' },
                { term: 'Fallow Land', definition: 'Cultivable land left uncultivated for one or more agricultural seasons to restore fertility.', example: 'Current fallow: left uncultivated in the current year.' },
              ],
              [{ scenario: 'Farmer in Rajasthan leaves land uncultivated every third year.', connection: 'This is fallow land practice — it helps restore soil nutrients naturally, a traditional land management technique.' }]
            ),
          },
        ],
      },
    ],
  },

  // ── English Language ─────────────────────────────────────────────────────
  {
    name: 'English Language',
    slug: 'english-language',
    chapters: [
      {
        name: 'First Flight – Literature',
        slug: 'first-flight-literature',
        order: 1,
        topics: [
          {
            name: 'A Letter to God – Comprehension',
            slug: 'a-letter-to-god',
            order: 1,
            note: buildNote(
              'A Letter to God',
              '"A Letter to God" by G.L. Fuentes tells the story of Lencho, a farmer who writes a letter to God after a hailstorm destroys his crops, demonstrating unwavering faith contrasted with irony and human indifference.',
              [
                { heading: 'Plot and Characters', explanation: "Lencho, a hardworking farmer, sees his crops destroyed by a hailstorm. His faith in God is absolute — he writes a letter to God asking for 100 pesos to resow. The postmaster, moved by Lencho's faith, collects 70 pesos from staff and friends and sends it anonymously. Lencho, on receiving only 70 pesos, writes again accusing the post office employees of stealing the rest.", keyTakeaway: 'Lencho = blind faith; Post office = human kindness; Irony = Lencho doubts his helpers.' },
                { heading: 'Themes and Literary Devices', explanation: "Themes: (1) Unwavering faith — Lencho never doubts God. (2) Irony — those who help are accused of theft. (3) Human kindness — the postmaster's selfless act. Literary devices: personification (the rain compared to locusts), metaphor, irony. The story questions whether blind faith ignores human goodness around us.", keyTakeaway: 'Theme: faith vs. irony of human kindness going unrecognised.' },
              ],
              [
                { term: 'Irony', definition: 'A literary device where the outcome is contrary to what is expected.', example: 'Lencho accuses the kind helpers of being thieves — the opposite of their true nature.' },
                { term: 'Personification', definition: 'Giving human qualities to non-human things.', example: '"The rain was like new coins" — comparing rain to money.' },
              ],
              [{ scenario: 'Lencho receives 70 pesos instead of 100.', connection: 'He interprets the shortage as theft by the post office employees, never considering they donated their own money — a tragic irony that forms the story\'s climax.' }]
            ),
          },
          {
            name: 'Nelson Mandela – Long Walk to Freedom',
            slug: 'nelson-mandela-long-walk-to-freedom',
            order: 2,
            note: buildNote(
              'Nelson Mandela – Long Walk to Freedom',
              'This excerpt from Nelson Mandela\'s autobiography describes his inauguration as South Africa\'s first black President on 10 May 1994 and his reflections on freedom, courage, and the obligations of the human spirit.',
              [
                { heading: 'The Inauguration Scene', explanation: "The ceremony took place in the Union Buildings amphitheatre, Pretoria. Military generals who had previously jailed Mandela now saluted him. Mandela saw this as a victory for justice, not just for himself. He was joined by world leaders. He says the sight of the jet fighters, military helicopters, and the saluting generals moved him — it showed the transformation of the apartheid state into one that recognised the rights of all.", keyTakeaway: 'Inauguration = triumph of justice; former oppressors now saluted Mandela.' },
                { heading: 'Meaning of Freedom and Courage', explanation: 'Mandela distinguishes two obligations — to family and to people/community. He argues that the oppressor is also a prisoner of hatred, losing their humanity. True freedom means freedom of all — not just from chains, but to live with dignity. Courage is not the absence of fear but the triumph over it. He names Walter Sisulu, Oliver Tambo, Chris Hani, and others as the true heroes of the struggle.', keyTakeaway: 'Freedom = freedom of all; Courage = triumph over fear, not its absence.' },
              ],
              [
                { term: 'Apartheid', definition: 'A system of institutionalised racial segregation in South Africa from 1948–1994.', example: 'Black South Africans were denied voting rights, education equality, and freedom of movement under apartheid.' },
                { term: 'Inauguration', definition: 'Formal ceremony inducting a person into a position of authority.', example: 'Mandela\'s inauguration on 10 May 1994 marked the end of apartheid rule.' },
              ],
              [{ scenario: "Mandela's reflection on the generals who once imprisoned him now saluting him.", connection: 'This symbolises the complete transformation of South Africa — the oppressor system bowing to the values of freedom and human dignity.' }]
            ),
          },
        ],
      },
      {
        name: 'Grammar and Writing Skills',
        slug: 'grammar-and-writing-skills',
        order: 2,
        topics: [
          {
            name: 'Tenses and Sentence Transformation',
            slug: 'tenses-and-sentence-transformation',
            order: 1,
            note: buildNote(
              'Tenses and Sentence Transformation',
              'Tenses express the time of an action or state. Mastery of tenses and sentence transformation (active/passive, direct/indirect speech) is essential for both grammar and writing sections of the CBSE Class 10 English exam.',
              [
                { heading: 'Tenses Overview', explanation: 'There are 12 tenses formed from 3 time frames (past, present, future) × 4 aspects (simple, continuous, perfect, perfect continuous). Key exam tenses: Simple Present (habitual actions, general truths), Present Perfect (recently completed actions with present relevance), Simple Past (completed actions), Past Perfect (action completed before another past action). Formula for passive: Object + auxiliary be (in correct tense) + past participle + (by + agent).', keyTakeaway: '12 tenses = 3 time frames × 4 aspects. Passive = be + past participle.' },
                { heading: 'Sentence Transformation', explanation: 'Active to Passive: "She writes a letter" → "A letter is written by her." Rules: (1) Object becomes subject. (2) Add appropriate form of "be". (3) Verb becomes past participle. (4) Original subject becomes "by + agent" (optional). Direct to Indirect Speech: change pronouns, tense backshift, time/place expressions, and remove quotation marks. E.g., He said, "I am happy." → He said that he was happy.', keyTakeaway: 'Active→Passive: swap subject/object, add "be", use past participle. Direct→Indirect: backshift tense, change pronouns.' },
              ],
              [
                { term: 'Present Perfect', definition: 'Tense for actions completed recently or with present relevance. Form: have/has + past participle.', example: '"She has finished her homework" — the finishing is relevant now.' },
                { term: 'Passive Voice', definition: 'Sentence structure where the subject receives the action rather than performs it.', example: '"The book was written by Rowling" (passive) vs. "Rowling wrote the book" (active).' },
              ],
              [{ scenario: 'Exam question: Change to passive: "The teacher corrects the papers."', connection: 'Answer: "The papers are corrected by the teacher." — apply the passive formula: Object (papers) + is/are + past participle (corrected) + by + agent (teacher).' }]
            ),
          },
          {
            name: 'Formal Letter Writing',
            slug: 'formal-letter-writing',
            order: 2,
            note: buildNote(
              'Formal Letter Writing',
              'Formal letter writing is a key skill in the CBSE Class 10 English exam (Section B – Writing). Letters include formal/official letters, application letters, and complaint letters, each with a fixed format.',
              [
                { heading: 'Format of a Formal Letter', explanation: "Standard format: (1) Sender's address (top-left, no name), (2) Date, (3) Receiver's designation & address, (4) Subject line (brief), (5) Salutation (Dear Sir/Madam), (6) Body — Introduction paragraph, Main content (1-2 paragraphs), Conclusion paragraph, (7) Complimentary close (Yours faithfully / Yours sincerely), (8) Signature + Full name. 'Yours faithfully' is used when you don't know the name; 'Yours sincerely' when you do.", keyTakeaway: "8-part format: address → date → receiver → subject → salutation → body → close → sign." },
                { heading: 'Types and Tips', explanation: 'Types in CBSE exam: (a) Letter to editor (complaint/suggestion to newspaper), (b) Letter to authority (school principal, municipal officer), (c) Letter of application (job/internship). Tips: Be formal — no contractions, no slang. Be concise — 3 body paragraphs. State purpose in the first sentence. Use passive voice for polite distancing ("It is requested that…"). Common errors: missing subject line, wrong complimentary close, writing in first-last name format in sender\'s address.', keyTakeaway: "Three main types: editor, authority, application. Avoid contractions; state purpose early." },
              ],
              [
                { term: 'Salutation', definition: "The greeting line at the start of a letter body.", example: '"Dear Sir/Madam" (when name unknown); "Dear Mr. Sharma" (when name known).' },
                { term: 'Complimentary Close', definition: "The polite ending before the signature.", example: '"Yours faithfully" when salutation is Sir/Madam; "Yours sincerely" when a name is used.' },
              ],
              [{ scenario: "Student writes a letter to the Municipal Commissioner about waterlogging in their colony.", connection: "This is a letter to authority: use 'Dear Sir/Madam', include subject line 'Waterlogging in XYZ Colony', body with problem + impact + request, close with 'Yours faithfully'." }]
            ),
          },
        ],
      },
    ],
  },
];

// ============================================================================
// CURRICULUM SEED (upsert subjects → chapters → topics → notes → tests)
// ============================================================================

async function seedCurriculum(board, classLevel) {
  const stats = { subjects: 0, chapters: 0, topics: 0, notes: 0, tests: 0, questions: 0 };

  for (const subj of EXTRA_SUBJECTS) {
    let subject;
    if (DRY_RUN) {
      console.log(`  [DRY] Subject: ${subj.name}`);
      subject = { id: `dry-${subj.slug}`, name: subj.name };
    } else {
      subject = await prisma.subjectDef.upsert({
        where: { classId_slug: { classId: classLevel.id, slug: subj.slug } },
        update: {},
        create: { classId: classLevel.id, name: subj.name, slug: subj.slug },
      });
    }
    stats.subjects++;

    for (const ch of subj.chapters) {
      let chapter;
      if (DRY_RUN) {
        console.log(`    [DRY] Chapter: ${ch.name}`);
        chapter = { id: `dry-${ch.slug}`, name: ch.name };
      } else {
        chapter = await prisma.chapterDef.upsert({
          where: { subjectId_slug_version: { subjectId: subject.id, slug: ch.slug, version: 1 } },
          update: { name: ch.name, order: ch.order, status: 'approved' },
          create: { subjectId: subject.id, name: ch.name, slug: ch.slug, order: ch.order, version: 1, status: 'approved' },
        });
      }
      stats.chapters++;

      for (const tp of ch.topics) {
        let topic;
        if (DRY_RUN) {
          console.log(`      [DRY] Topic: ${tp.name}`);
          topic = { id: `dry-${tp.slug}`, name: tp.name };
        } else {
          topic = await prisma.topicDef.upsert({
            where: { chapterId_slug: { chapterId: chapter.id, slug: tp.slug } },
            update: { name: tp.name, order: tp.order, status: 'approved' },
            create: { chapterId: chapter.id, name: tp.name, slug: tp.slug, order: tp.order, status: 'approved' },
          });

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
              update: { title: `${tp.name} – ${diff[0].toUpperCase() + diff.slice(1)}`, status: 'approved' },
              create: { topicId: topic.id, title: `${tp.name} – ${diff[0].toUpperCase() + diff.slice(1)}`, difficulty: diff, language: 'en', version: 1, status: 'approved' },
            });
            await prisma.generatedQuestion.deleteMany({ where: { testId: test.id } });
            await prisma.generatedQuestion.createMany({ data: qBank[diff].map(q => ({ testId: test.id, ...q })) });
            stats.tests++;
            stats.questions += qBank[diff].length;
          }
        }
        stats.topics++;
      }
    }
  }

  return stats;
}

// ============================================================================
// FETCH ALL CBSE GRADE-10 TOPICS (Science + Math already exist + new subjects)
// ============================================================================

async function fetchAllTopics() {
  const board = await prisma.board.findUnique({ where: { slug: BOARD_SLUG } });
  if (!board) throw new Error(`Board '${BOARD_SLUG}' not found. Run seed-ai-content first.`);

  const classLevel = await prisma.classLevel.findUnique({
    where: { boardId_grade: { boardId: board.id, grade: GRADE } },
  });
  if (!classLevel) throw new Error(`ClassLevel grade ${GRADE} not found for CBSE.`);

  const subjects = await prisma.subjectDef.findMany({
    where: { classId: classLevel.id },
    include: { chapters: { include: { topics: true } } },
  });

  return { board, classLevel, subjects };
}

// ============================================================================
// STUDENT PROFILES
// ============================================================================

const STUDENTS = [
  {
    email: 'arjun.sharma@test10.cbse',
    name: 'Arjun Sharma',
    label: 'struggling',
    board: 'cbse', grade: '10', language: 'en',
    subjects: ['Science', 'Mathematics', 'Social Science'],
    dailyTargetMin: 30, studyDaysPerWeek: 4,
    currentStreak: 3, longestStreak: 7,
    totalSessionsCompleted: 6, learningPoints: 180,
    weakSubjects: ['Science', 'Social Science'],
  },
  {
    email: 'priya.patel@test10.cbse',
    name: 'Priya Patel',
    label: 'high_achiever',
    board: 'cbse', grade: '10', language: 'en',
    subjects: ['Science', 'Mathematics', 'Social Science', 'English Language'],
    dailyTargetMin: 60, studyDaysPerWeek: 6,
    currentStreak: 15, longestStreak: 21,
    totalSessionsCompleted: 22, learningPoints: 860,
    weakSubjects: [],
  },
  {
    email: 'ravi.kumar@test10.cbse',
    name: 'Ravi Kumar',
    label: 'mixed',
    board: 'cbse', grade: '10', language: 'en',
    subjects: ['Mathematics', 'Science', 'Social Science'],
    dailyTargetMin: 45, studyDaysPerWeek: 5,
    currentStreak: 7, longestStreak: 12,
    totalSessionsCompleted: 14, learningPoints: 430,
    weakSubjects: ['Science'],
  },
];

// Mastery config per student per subject slug
const MASTERY_CONFIG = {
  arjun: {
    science:        { accuracy: 48, level: 'beginner',      attempts: 6 },
    mathematics:    { accuracy: 66, level: 'intermediate',  attempts: 12 },
    'social-science': { accuracy: 42, level: 'beginner',    attempts: 5 },
    'english-language': null, // no progress yet
  },
  priya: {
    science:        { accuracy: 91, level: 'expert',        attempts: 20 },
    mathematics:    { accuracy: 88, level: 'advanced',      attempts: 18 },
    'social-science': { accuracy: 84, level: 'advanced',    attempts: 15 },
    'english-language': { accuracy: 92, level: 'expert',   attempts: 16 },
  },
  ravi: {
    science:        { accuracy: 58, level: 'intermediate',  attempts: 10 },
    mathematics:    { accuracy: 85, level: 'advanced',      attempts: 16 },
    'social-science': { accuracy: 68, level: 'intermediate', attempts: 9 },
    'english-language': { accuracy: 72, level: 'intermediate', attempts: 8 },
  },
};

// ── helpers ──────────────────────────────────────────────────────────────────

async function upsertUser(data) {
  const { email, name, language, board, grade, subjects } = data;
  return prisma.user.upsert({
    where: { email },
    update: { name, language, board, grade, subjects },
    create: { email, name, language, board, grade, subjects },
  });
}

async function seedEngagement(studentId, cfg) {
  await prisma.studentEngagementStats.upsert({
    where: { studentId },
    update: {
      currentStreak:         cfg.currentStreak,
      longestStreak:         cfg.longestStreak,
      lastActiveDate:        daysAgo(0),
      totalSessionsCompleted: cfg.totalSessionsCompleted,
      learningPoints:        cfg.learningPoints,
    },
    create: {
      studentId,
      currentStreak:         cfg.currentStreak,
      longestStreak:         cfg.longestStreak,
      lastActiveDate:        daysAgo(0),
      totalSessionsCompleted: cfg.totalSessionsCompleted,
      learningPoints:        cfg.learningPoints,
    },
  });

  // StudentStreak (kind='daily')
  await prisma.studentStreak.upsert({
    where: { id: `streak-${studentId}` },
    update: { current: cfg.currentStreak, best: cfg.longestStreak, lastActive: daysAgo(0) },
    create: { id: `streak-${studentId}`, studentId, kind: 'daily', current: cfg.currentStreak, best: cfg.longestStreak, lastActive: daysAgo(0) },
  }).catch(() =>
    // fallback without forced id if collision
    prisma.studentStreak.upsert({
      where: { id: `streak-${studentId}` },
      update: { current: cfg.currentStreak, best: cfg.longestStreak, lastActive: daysAgo(0) },
      create: { studentId, kind: 'daily', current: cfg.currentStreak, best: cfg.longestStreak, lastActive: daysAgo(0) },
    })
  );
}

async function seedLearningProfile(studentId, cfg) {
  await prisma.studentLearningProfile.upsert({
    where: { studentId },
    update: {
      dailyTargetMin:   cfg.dailyTargetMin,
      studyDaysPerWeek: cfg.studyDaysPerWeek,
      weakSubjects:     cfg.weakSubjects,
      recommendations:  { generatedAt: new Date().toISOString(), learningPath: [] },
    },
    create: {
      studentId,
      dailyTargetMin:   cfg.dailyTargetMin,
      studyDaysPerWeek: cfg.studyDaysPerWeek,
      weakSubjects:     cfg.weakSubjects,
      recommendations:  { generatedAt: new Date().toISOString(), learningPath: [] },
    },
  });
}

async function seedMastery(studentId, subjects) {
  for (const subj of subjects) {
    const subjSlug = subj.slug;
    const cfgKey   = Object.keys(MASTERY_CONFIG).find(k => studentId.includes(k)) || 'arjun';
    const mc       = (MASTERY_CONFIG[cfgKey] || {})[subjSlug];
    if (!mc) continue;

    for (const chapter of subj.chapters) {
      for (const topic of chapter.topics) {
        // TopicMastery – slight variance per topic
        const variance = Math.round((Math.random() - 0.5) * 8);
        const acc      = Math.min(100, Math.max(10, mc.accuracy + variance));

        await prisma.studentTopicMastery.upsert({
          where: { studentId_topicId: { studentId, topicId: topic.id } },
          update: { accuracy: acc, questionsAttempted: mc.attempts, masteryLevel: mc.level, lastAttemptedAt: daysAgo(Math.floor(Math.random() * 14) + 1) },
          create: { studentId, topicId: topic.id, subject: subj.name, chapter: chapter.name, accuracy: acc, questionsAttempted: mc.attempts, masteryLevel: mc.level, lastAttemptedAt: daysAgo(Math.floor(Math.random() * 14) + 1) },
        });

        // TopicProgress (mastery as 0-1 float)
        const masteryFloat = acc / 100;
        await prisma.studentTopicProgress.upsert({
          where: { studentId_topicId: { studentId, topicId: topic.id } },
          update: { mastery: masteryFloat, practiceCount: mc.attempts, lastStudiedAt: daysAgo(Math.floor(Math.random() * 10) + 1) },
          create: { studentId, topicId: topic.id, mastery: masteryFloat, practiceCount: mc.attempts, lastStudiedAt: daysAgo(Math.floor(Math.random() * 10) + 1) },
        });
      }
    }
  }
}

async function seedStructuredSessions(studentId, topics, label) {
  const configs = {
    struggling: [
      // 3 completed sessions (Science topics)
      { topicIdx: 0, state: 'COMPLETE', completedAt: daysAgo(8), daysAgo_: 9 },
      { topicIdx: 1, state: 'COMPLETE', completedAt: daysAgo(5), daysAgo_: 6 },
      { topicIdx: 2, state: 'COMPLETE', completedAt: daysAgo(2), daysAgo_: 3 },
      // 1 active session
      { topicIdx: 3, state: 'PRACTICE', completedAt: null, daysAgo_: 0 },
      // 1 expired session
      { topicIdx: 4, state: 'EXPIRED',  completedAt: null, daysAgo_: 4 },
    ],
    high_achiever: [
      { topicIdx: 0,  state: 'COMPLETE', completedAt: daysAgo(14), daysAgo_: 15 },
      { topicIdx: 1,  state: 'COMPLETE', completedAt: daysAgo(12), daysAgo_: 13 },
      { topicIdx: 2,  state: 'COMPLETE', completedAt: daysAgo(10), daysAgo_: 11 },
      { topicIdx: 3,  state: 'COMPLETE', completedAt: daysAgo(8),  daysAgo_: 9  },
      { topicIdx: 4,  state: 'COMPLETE', completedAt: daysAgo(6),  daysAgo_: 7  },
      { topicIdx: 5,  state: 'COMPLETE', completedAt: daysAgo(4),  daysAgo_: 5  },
      { topicIdx: 6,  state: 'COMPLETE', completedAt: daysAgo(2),  daysAgo_: 3  },
      { topicIdx: 7,  state: 'COMPLETE', completedAt: daysAgo(1),  daysAgo_: 2  },
      // 1 active (homework phase)
      { topicIdx: 8,  state: 'HOMEWORK', completedAt: null, daysAgo_: 0 },
    ],
    mixed: [
      { topicIdx: 0, state: 'COMPLETE', completedAt: daysAgo(10), daysAgo_: 11 },
      { topicIdx: 1, state: 'COMPLETE', completedAt: daysAgo(8),  daysAgo_: 9  },
      { topicIdx: 2, state: 'COMPLETE', completedAt: daysAgo(5),  daysAgo_: 6  },
      { topicIdx: 3, state: 'COMPLETE', completedAt: daysAgo(3),  daysAgo_: 4  },
      { topicIdx: 4, state: 'COMPLETE', completedAt: daysAgo(1),  daysAgo_: 2  },
      // 1 active (practice phase)
      { topicIdx: 5, state: 'PRACTICE', completedAt: null, daysAgo_: 0 },
    ],
  };

  const sessCfgs = configs[label] || configs.mixed;
  const createdSessions = [];

  for (const sc of sessCfgs) {
    const topic = topics[sc.topicIdx % topics.length];
    const session = await prisma.structuredSession.create({
      data: {
        studentId,
        topicId:     topic.id,
        state:       sc.state,
        startedAt:   daysAgo(sc.daysAgo_),
        completedAt: sc.completedAt,
        meta:        { seededBy: 'seed-dashboard-test-data', label },
      },
    });

    // Seed SessionEvents for completed sessions
    if (sc.state === 'COMPLETE') {
      await prisma.sessionEvent.createMany({
        data: [
          { sessionId: session.id, eventType: 'SESSION_STARTED',        timestamp: daysAgo(sc.daysAgo_),        metadata: null },
          { sessionId: session.id, eventType: 'SESSION_OVERVIEW_VIEWED', timestamp: daysAgo(sc.daysAgo_),       metadata: null },
          { sessionId: session.id, eventType: 'PHASE_STARTED',           timestamp: daysAgo(sc.daysAgo_),       metadata: { phase: 'EXPLANATION' } },
          { sessionId: session.id, eventType: 'QUESTION_ANSWERED',       timestamp: sc.completedAt || daysAgo(1), metadata: { correct: true } },
          { sessionId: session.id, eventType: 'SESSION_COMPLETED',       timestamp: sc.completedAt || daysAgo(1), metadata: { score: 80 } },
        ],
        skipDuplicates: true,
      });
    }

    createdSessions.push(session);
  }
  return createdSessions;
}

async function seedHomework(studentId, topics, label) {
  const homeworkTemplates = {
    struggling: [
      { topicIdx: 0, status: 'OVERDUE',  dueDate: daysAgo(3), score: null },
      { topicIdx: 1, status: 'OVERDUE',  dueDate: daysAgo(7), score: null },
      { topicIdx: 2, status: 'PENDING',  dueDate: daysAgo(-3), score: null },
    ],
    high_achiever: [
      { topicIdx: 0, status: 'GRADED',   dueDate: daysAgo(12), score: 92 },
      { topicIdx: 1, status: 'GRADED',   dueDate: daysAgo(8),  score: 88 },
      { topicIdx: 2, status: 'SUBMITTED', dueDate: daysAgo(2), score: null },
      { topicIdx: 3, status: 'PENDING',  dueDate: daysAgo(-2), score: null },
    ],
    mixed: [
      { topicIdx: 0, status: 'GRADED',   dueDate: daysAgo(8),  score: 72 },
      { topicIdx: 1, status: 'SUBMITTED', dueDate: daysAgo(2), score: null },
      { topicIdx: 2, status: 'PENDING',  dueDate: daysAgo(-3), score: null },
    ],
  };

  const templates = homeworkTemplates[label] || homeworkTemplates.mixed;
  const sampleQuestions = [
    { id: 'q1', text: 'Explain the concept in your own words.', type: 'short_answer', marks: 5 },
    { id: 'q2', text: 'Choose the correct option:', type: 'mcq', options: ['A', 'B', 'C', 'D'], answer: 'A', marks: 2 },
  ];

  for (const tmpl of templates) {
    const topic = topics[tmpl.topicIdx % topics.length];
    const hw = await prisma.homeworkAssignment.create({
      data: {
        studentId,
        topicId:   topic.id,
        questions: sampleQuestions,
        status:    tmpl.status,
        dueDate:   tmpl.dueDate,
        score:     tmpl.score,
      },
    });

    // Add HomeworkAnswers for SUBMITTED + GRADED
    if (tmpl.status === 'SUBMITTED' || tmpl.status === 'GRADED') {
      await prisma.homeworkAnswer.createMany({
        data: [
          { assignmentId: hw.id, questionId: 'q1', studentAnswer: { text: 'Sample student answer for q1.' }, isCorrect: true },
          { assignmentId: hw.id, questionId: 'q2', studentAnswer: { selected: 'A' }, isCorrect: true },
        ],
        skipDuplicates: true,
      });
    }
  }
}

async function seedRecommendations(studentId, topics, label) {
  const configs = {
    struggling: [
      { topicIdx: 0, contentId: null, isShown: true,  isClicked: false, isIgnored: false, firstShownAt: daysAgo(1) },
      { topicIdx: 1, contentId: null, isShown: true,  isClicked: true,  isIgnored: false, firstShownAt: daysAgo(2), clickedAt: daysAgo(2) },
    ],
    high_achiever: [
      { topicIdx: 0, contentId: null, isShown: true,  isClicked: true,  isCompleted: true, firstShownAt: daysAgo(4), clickedAt: daysAgo(4), completedAt: daysAgo(3) },
      { topicIdx: 1, contentId: null, isShown: true,  isClicked: true,  isCompleted: true, firstShownAt: daysAgo(2), clickedAt: daysAgo(2), completedAt: daysAgo(1) },
      { topicIdx: 2, contentId: null, isShown: true,  isClicked: false, isIgnored: true,  firstShownAt: daysAgo(1), ignoredAt: hoursAgo(6) },
    ],
    mixed: [
      { topicIdx: 0, contentId: null, isShown: true, isClicked: true,  isCompleted: false, firstShownAt: daysAgo(2), clickedAt: daysAgo(2) },
      { topicIdx: 1, contentId: null, isShown: true, isClicked: false, isIgnored: false,  firstShownAt: daysAgo(1) },
    ],
  };

  const cfgs = configs[label] || configs.mixed;
  for (const rc of cfgs) {
    const topic    = topics[rc.topicIdx % topics.length];
    const contentId = `notes:${topic.id}`;
    await prisma.contentRecommendation.upsert({
      where:  { userId_contentId: { userId: studentId, contentId } },
      update: {},
      create: {
        userId:      studentId,
        contentId,
        isShown:     rc.isShown     || false,
        isClicked:   rc.isClicked   || false,
        isCompleted: rc.isCompleted || false,
        isIgnored:   rc.isIgnored   || false,
        firstShownAt: rc.firstShownAt || null,
        lastShownAt:  rc.firstShownAt || null,
        clickedAt:    rc.clickedAt    || null,
        completedAt:  rc.completedAt  || null,
        ignoredAt:    rc.ignoredAt    || null,
      },
    });
  }
}

async function seedWeeklySummaries(studentId, label) {
  const summaryConfigs = {
    struggling: [
      { weeksBack: 4, topics: 1, tests: 2, avgScore: 48, minutes: 35, sessions: 2 },
      { weeksBack: 3, topics: 1, tests: 1, avgScore: 52, minutes: 40, sessions: 2 },
      { weeksBack: 2, topics: 2, tests: 2, avgScore: 50, minutes: 55, sessions: 2 },
      { weeksBack: 1, topics: 1, tests: 2, avgScore: 55, minutes: 45, sessions: 2 },
      { weeksBack: 0, topics: 0, tests: 1, avgScore: 48, minutes: 20, sessions: 1 },
    ],
    high_achiever: [
      { weeksBack: 8, topics: 3, tests: 5, avgScore: 86, minutes: 210, sessions: 5 },
      { weeksBack: 7, topics: 4, tests: 6, avgScore: 88, minutes: 240, sessions: 6 },
      { weeksBack: 6, topics: 3, tests: 5, avgScore: 87, minutes: 195, sessions: 5 },
      { weeksBack: 5, topics: 4, tests: 7, avgScore: 90, minutes: 260, sessions: 6 },
      { weeksBack: 4, topics: 3, tests: 6, avgScore: 89, minutes: 230, sessions: 6 },
      { weeksBack: 3, topics: 4, tests: 7, avgScore: 91, minutes: 275, sessions: 7 },
      { weeksBack: 2, topics: 3, tests: 6, avgScore: 92, minutes: 250, sessions: 6 },
      { weeksBack: 1, topics: 4, tests: 7, avgScore: 93, minutes: 280, sessions: 7 },
      { weeksBack: 0, topics: 2, tests: 3, avgScore: 91, minutes: 120, sessions: 3 },
    ],
    mixed: [
      { weeksBack: 6, topics: 2, tests: 3, avgScore: 68, minutes: 95,  sessions: 3 },
      { weeksBack: 5, topics: 2, tests: 4, avgScore: 72, minutes: 110, sessions: 4 },
      { weeksBack: 4, topics: 3, tests: 4, avgScore: 74, minutes: 120, sessions: 4 },
      { weeksBack: 3, topics: 2, tests: 4, avgScore: 75, minutes: 115, sessions: 4 },
      { weeksBack: 2, topics: 3, tests: 5, avgScore: 77, minutes: 135, sessions: 5 },
      { weeksBack: 1, topics: 3, tests: 5, avgScore: 79, minutes: 140, sessions: 5 },
      { weeksBack: 0, topics: 2, tests: 3, avgScore: 78, minutes: 90,  sessions: 3 },
    ],
  };

  const summaries = summaryConfigs[label] || summaryConfigs.mixed;
  for (const s of summaries) {
    const ws = weekStart(weeksAgo(s.weeksBack));
    await prisma.weeklyStudentSummary.upsert({
      where: { studentId_weekStart: { studentId, weekStart: ws } },
      update: { topicsCovered: s.topics, testsTaken: s.tests, averageScore: s.avgScore, totalMinutes: s.minutes, sessionsCount: s.sessions },
      create: { studentId, weekStart: ws, topicsCovered: s.topics, testsTaken: s.tests, averageScore: s.avgScore, totalMinutes: s.minutes, sessionsCount: s.sessions },
    });
  }
}

async function seedSubjectSummaries(studentId, subjects, label) {
  for (const subj of subjects) {
    const cfgKey = Object.keys(MASTERY_CONFIG).find(k => label.includes(k.slice(0, 4)));
    const mc = (MASTERY_CONFIG[cfgKey || 'arjun'] || {})[subj.slug];
    if (!mc) continue;

    const totalTopics   = subj.chapters.reduce((n, ch) => n + ch.topics.length, 0);
    const topicsCovered = label === 'struggling' ? Math.floor(totalTopics * 0.6)
                        : label === 'high_achiever' ? totalTopics
                        : Math.floor(totalTopics * 0.8);
    const strong = label === 'high_achiever' ? totalTopics : Math.floor(topicsCovered * 0.4);
    const weak   = label === 'struggling'    ? Math.floor(topicsCovered * 0.6) : Math.floor(topicsCovered * 0.2);

    await prisma.subjectProgressSummary.upsert({
      where: { studentId_subject: { studentId, subject: subj.name } },
      update: { totalTopics, topicsCovered, averageMastery: mc.accuracy / 100, strongTopics: strong, weakTopics: weak },
      create: { studentId, subject: subj.name, board: 'cbse', totalTopics, topicsCovered, averageMastery: mc.accuracy / 100, strongTopics: strong, weakTopics: weak },
    });
  }
}

// ============================================================================
// PARENT ACCOUNTS & LINKS
// ============================================================================

const PARENTS = [
  { email: 'kavita.sharma@parent.test', name: 'Kavita Sharma', studentEmail: 'arjun.sharma@test10.cbse' },
  { email: 'suresh.patel@parent.test',  name: 'Suresh Patel',  studentEmail: 'priya.patel@test10.cbse'  },
];

async function seedParents(studentMap) {
  const results = [];
  for (const p of PARENTS) {
    const parent = await prisma.user.upsert({
      where: { email: p.email },
      update: { name: p.name },
      create: { email: p.email, name: p.name, language: 'en' },
    });

    const studentId = studentMap[p.studentEmail];
    if (!studentId) { warn(`Parent ${p.name}: student ${p.studentEmail} not found`); continue; }

    await prisma.parentStudent.upsert({
      where: { parentId_studentId: { parentId: parent.id, studentId } },
      update: { status: 'active' },
      create: { parentId: parent.id, studentId, status: 'active' },
    });

    results.push({ parentName: p.name, parentEmail: p.email, linkedStudentEmail: p.studentEmail });
  }
  return results;
}

// ============================================================================
// VALIDATION CHECKS
// ============================================================================

async function runValidations(studentIds) {
  // 1. Engagement stats
  const engStats = await prisma.studentEngagementStats.count({ where: { studentId: { in: studentIds } } });
  engStats === studentIds.length ? pass(`StudentEngagementStats present for all ${studentIds.length} students`) : warn(`StudentEngagementStats: expected ${studentIds.length}, found ${engStats}`);

  // 2. Learning profiles
  const profiles = await prisma.studentLearningProfile.count({ where: { studentId: { in: studentIds } } });
  profiles === studentIds.length ? pass('StudentLearningProfile present for all students') : warn(`StudentLearningProfile: expected ${studentIds.length}, found ${profiles}`);

  // 3. Topic mastery records
  const mastery = await prisma.studentTopicMastery.count({ where: { studentId: { in: studentIds } } });
  mastery > 0 ? pass(`StudentTopicMastery: ${mastery} records across students`) : warn('No StudentTopicMastery records found');

  // 4. Topic progress records
  const progress = await prisma.studentTopicProgress.count({ where: { studentId: { in: studentIds } } });
  progress > 0 ? pass(`StudentTopicProgress: ${progress} records`) : warn('No StudentTopicProgress records found');

  // 5. Structured sessions
  const sessions = await prisma.structuredSession.count({ where: { studentId: { in: studentIds } } });
  sessions > 0 ? pass(`StructuredSession: ${sessions} total sessions`) : warn('No StructuredSession records found');

  const completedSessions = await prisma.structuredSession.count({ where: { studentId: { in: studentIds }, state: 'COMPLETE' } });
  completedSessions > 0 ? pass(`COMPLETE sessions: ${completedSessions}`) : warn('No COMPLETE sessions found');

  const activeSessions = await prisma.structuredSession.count({ where: { studentId: { in: studentIds }, state: { in: ['PRACTICE', 'HOMEWORK', 'EXPLANATION', 'OVERVIEW'] } } });
  activeSessions > 0 ? pass(`Active (in-progress) sessions: ${activeSessions}`) : warn('No active sessions found (needed for "resume" CTA)');

  const expiredSessions = await prisma.structuredSession.count({ where: { studentId: { in: studentIds }, state: 'EXPIRED' } });
  expiredSessions > 0 ? pass(`EXPIRED sessions: ${expiredSessions}`) : warn('No EXPIRED sessions');

  // 6. Homework
  const hwPending = await prisma.homeworkAssignment.count({ where: { studentId: { in: studentIds }, status: 'PENDING' } });
  const hwOverdue = await prisma.homeworkAssignment.count({ where: { studentId: { in: studentIds }, status: 'OVERDUE' } });
  const hwGraded  = await prisma.homeworkAssignment.count({ where: { studentId: { in: studentIds }, status: 'GRADED'  } });
  hwPending > 0 ? pass(`PENDING homework: ${hwPending}`) : warn('No PENDING homework (HomeworkPendingCard may be hidden)');
  hwOverdue > 0 ? pass(`OVERDUE homework: ${hwOverdue}`) : warn('No OVERDUE homework');
  hwGraded  > 0 ? pass(`GRADED homework:  ${hwGraded}`) : warn('No GRADED homework');

  // 7. Weak topics (accuracy < 70)
  const weakTopics = await prisma.studentTopicMastery.count({ where: { studentId: { in: studentIds }, accuracy: { lt: 70 } } });
  weakTopics > 0 ? pass(`Weak topics (<70% accuracy): ${weakTopics} — WeakTopicsSection will render`) : warn('No weak topics — WeakTopicsSection may be hidden for all students');

  // 8. Recommendations
  const recs = await prisma.contentRecommendation.count({ where: { userId: { in: studentIds } } });
  recs > 0 ? pass(`ContentRecommendation: ${recs} records`) : warn('No ContentRecommendation records');

  // 9. Weekly summaries
  const weeklySummaries = await prisma.weeklyStudentSummary.count({ where: { studentId: { in: studentIds } } });
  weeklySummaries >= 5 ? pass(`WeeklyStudentSummary: ${weeklySummaries} rows (8-week trend chart coverage)`) : warn(`WeeklyStudentSummary: only ${weeklySummaries} rows — trend chart may be sparse`);

  // 10. Parent links
  const parentLinks = await prisma.parentStudent.count({ where: { studentId: { in: studentIds } } });
  parentLinks > 0 ? pass(`ParentStudent links: ${parentLinks}`) : warn('No parent-student links');

  // 11. SubjectProgressSummary
  const sps = await prisma.subjectProgressSummary.count({ where: { studentId: { in: studentIds } } });
  sps > 0 ? pass(`SubjectProgressSummary: ${sps} rows (parent subject mastery card)`) : warn('No SubjectProgressSummary rows');

  // 12. SessionEvents
  const events = await prisma.sessionEvent.count({ where: { session: { studentId: { in: studentIds } } } });
  events > 0 ? pass(`SessionEvent: ${events} events logged`) : warn('No SessionEvent records');
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  seed-dashboard-test-data   CBSE · Grade 10 · English       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  if (DRY_RUN) {
    console.log('[DRY RUN] No DB writes will be performed.\n');
  }

  // ── 1. Curriculum ──────────────────────────────────────────────────────────
  console.log('▶ Step 1: Extending curriculum (Social Science + English Language)');
  if (!DRY_RUN) {
    const { board, classLevel, subjects: existingSubjects } = await fetchAllTopics();
    const currStats = await seedCurriculum(board, classLevel);
    report.curriculum = { board: board.name, grade: GRADE, ...currStats };
    console.log(`  ✓ Subjects added: ${currStats.subjects} | Chapters: ${currStats.chapters} | Topics: ${currStats.topics}`);
    console.log(`  ✓ Notes: ${currStats.notes} | Tests: ${currStats.tests} | Questions: ${currStats.questions}\n`);
  } else {
    for (const subj of EXTRA_SUBJECTS) {
      console.log(`  [DRY] Subject: ${subj.name}`);
      for (const ch of subj.chapters) {
        console.log(`    [DRY] Chapter: ${ch.name} (${ch.topics.length} topics)`);
      }
    }
    console.log('');
  }

  // ── 2. Students ────────────────────────────────────────────────────────────
  console.log('▶ Step 2: Creating 3 student profiles');
  const studentMap = {};  // email → id
  const studentIds = [];

  if (!DRY_RUN) {
    const { board, classLevel, subjects: allSubjects } = await fetchAllTopics();
    const flatTopics = allSubjects.flatMap(s => s.chapters.flatMap(ch => ch.topics));

    for (const cfg of STUDENTS) {
      const user = await upsertUser(cfg);
      studentMap[cfg.email] = user.id;
      studentIds.push(user.id);

      console.log(`\n  ── ${cfg.name} (${cfg.email}) ─────────────────────`);

      await seedLearningProfile(user.id, cfg);
      console.log(`     ✓ LearningProfile: target=${cfg.dailyTargetMin}min, days=${cfg.studyDaysPerWeek}/wk, weak=${cfg.weakSubjects.join(',') || 'none'}`);

      await seedEngagement(user.id, cfg);
      console.log(`     ✓ Engagement: streak=${cfg.currentStreak}d, best=${cfg.longestStreak}d, points=${cfg.learningPoints}, sessions=${cfg.totalSessionsCompleted}`);

      const subjsForStudent = allSubjects.filter(s => cfg.subjects.includes(s.name));
      await seedMastery(user.id, subjsForStudent);
      const masteryCount = subjsForStudent.reduce((n, s) => n + s.chapters.reduce((m, ch) => m + ch.topics.length, 0), 0);
      console.log(`     ✓ TopicMastery: ${masteryCount} topic records seeded`);

      const sessions = await seedStructuredSessions(user.id, flatTopics, cfg.label);
      console.log(`     ✓ Sessions: ${sessions.length} seeded (${sessions.filter(s => s.state === 'COMPLETE').length} complete, ${sessions.filter(s => !['COMPLETE','EXPIRED'].includes(s.state)).length} active)`);

      await seedHomework(user.id, flatTopics, cfg.label);
      console.log(`     ✓ Homework assignments created`);

      await seedRecommendations(user.id, flatTopics, cfg.label);
      console.log(`     ✓ ContentRecommendations created`);

      await seedWeeklySummaries(user.id, cfg.label);
      console.log(`     ✓ WeeklyStudentSummaries (for parent 8-week trend)`);

      await seedSubjectSummaries(user.id, subjsForStudent, cfg.label);
      console.log(`     ✓ SubjectProgressSummary`);

      report.students[cfg.email] = { name: cfg.name, label: cfg.label, id: user.id };
    }
  } else {
    for (const cfg of STUDENTS) {
      console.log(`  [DRY] Student: ${cfg.name} (${cfg.email}) – ${cfg.label}`);
    }
  }
  console.log('');

  // ── 3. Parents ─────────────────────────────────────────────────────────────
  console.log('▶ Step 3: Creating parent accounts + linking to students');
  if (!DRY_RUN) {
    const parentResults = await seedParents(studentMap);
    for (const p of parentResults) {
      console.log(`  ✓ ${p.parentName} (${p.parentEmail}) → linked to ${p.linkedStudentEmail}`);
    }
  } else {
    for (const p of PARENTS) {
      console.log(`  [DRY] Parent: ${p.name} → ${p.studentEmail}`);
    }
  }
  console.log('');

  // ── 4. Validation ──────────────────────────────────────────────────────────
  console.log('▶ Step 4: Running dashboard layer validations');
  if (!DRY_RUN) {
    await runValidations(studentIds);
    const passes  = report.validations.filter(v => v.status === 'PASS').length;
    const warns   = report.warnings.length + report.validations.filter(v => v.status === 'WARN').length;
    for (const v of report.validations) {
      console.log(`  ${v.status === 'PASS' ? '✓' : '!'} ${v.label}`);
    }
    console.log(`\n  Result: ${passes} PASS, ${warns} WARN\n`);
  } else {
    console.log('  [DRY] Skipping DB validations\n');
  }

  // ── 5. Print actionable report ─────────────────────────────────────────────
  printReport(studentMap);
}

// ============================================================================
// REPORT
// ============================================================================

function printReport(studentMap) {
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    SEED REPORT – ACTIONABLE DASHBOARD TEST              ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('CURRICULUM (CBSE · Grade 10 · English)');
  console.log('──────────────────────────────────────');
  console.log('  Subjects: Science, Mathematics, Social Science, English Language');
  console.log('  Chapters: 2 per subject (8 total)');
  console.log('  Topics  : 2 per chapter (16 total)');
  console.log('  Content : 1 TopicNote (en, approved) + 3 GeneratedTests (easy/medium/hard) per topic');
  console.log('');
  console.log('TEST STUDENTS');
  console.log('──────────────────────────────────────');
  console.log('  1. Arjun Sharma    arjun.sharma@test10.cbse    → Struggling student');
  console.log('       • Weak in Science (≈48%) + Social Science (≈42%)');
  console.log('       • Moderate Math (≈66%) · streak=3d · points=180');
  console.log('       • 2 OVERDUE homework · 1 PENDING · 3 completed sessions');
  console.log('       • Dashboard shows: HomeworkPendingCard (overdue), WeakTopicsSection,');
  console.log('         UpcomingTopicsList, EngagementSection (below target)');
  console.log('');
  console.log('  2. Priya Patel     priya.patel@test10.cbse     → High achiever');
  console.log('       • All subjects >84% accuracy · streak=15d · points=860');
  console.log('       • 2 GRADED + 1 SUBMITTED + 1 PENDING homework');
  console.log('       • 8 completed sessions + 1 HOMEWORK-phase active session');
  console.log('       • Dashboard shows: EngagementSection (target met), PrimaryActionCard');
  console.log('         (resume homework), 8-week trend in parent view');
  console.log('');
  console.log('  3. Ravi Kumar      ravi.kumar@test10.cbse       → Mixed performer');
  console.log('       • Strong Math (≈85%), weak Science (≈58%) · streak=7d · points=430');
  console.log('       • 1 GRADED + 1 SUBMITTED + 1 PENDING homework');
  console.log('       • 5 completed sessions + 1 PRACTICE-phase active session');
  console.log('       • Dashboard shows: WeakTopicsSection (Science), active session resume CTA');
  console.log('');
  console.log('PARENT ACCOUNTS');
  console.log('──────────────────────────────────────');
  console.log('  kavita.sharma@parent.test  → Parent of Arjun  (sees overdue HW, weak Science)');
  console.log('  suresh.patel@parent.test   → Parent of Priya  (sees 8-week upward trend)');
  console.log('');
  console.log('DASHBOARD LAYER COVERAGE');
  console.log('──────────────────────────────────────');
  console.log('  Student Dashboard');
  console.log('    ✓ EngagementSection       – streak + daily target (all 3 students)');
  console.log('    ✓ PrimaryActionCard        – resume session (Ravi / Priya) or start new (Arjun)');
  console.log('    ✓ HomeworkPendingCard      – PENDING + OVERDUE homework (Arjun: 3 items)');
  console.log('    ✓ WeakTopicsSection        – topics <70% accuracy (Arjun + Ravi)');
  console.log('    ✓ UpcomingTopicsList       – uncovered topics from curriculum');
  console.log('    ✓ WeeklyStudyStrip         – daily activity via StudentStreak');
  console.log('    ✓ NudgeBanner              – driven by StudentLearningProfile.weakSubjects');
  console.log('');
  console.log('  Parent Dashboard');
  console.log('    ✓ ParentWeeklyActivity    – WeeklyStudentSummary (up to 8 weeks)');
  console.log('    ✓ ParentSubjectMastery    – SubjectProgressSummary (accuracy per subject)');
  console.log('    ✓ ParentWeakTopics        – StudentTopicMastery with low accuracy');
  console.log('    ✓ ParentImprovementTrend  – StudentTopicProgress mastery over 8 weeks');
  console.log('');
  console.log('  Progress Intelligence');
  console.log('    ✓ StudentTopicMastery     – accuracy + mastery level per topic');
  console.log('    ✓ StudentTopicProgress    – mastery float (0-1) for trend');
  console.log('    ✓ StudentEngagementStats  – streak + points + session count');
  console.log('    ✓ StudentLearningProfile  – weakSubjects + daily target + study days');
  console.log('');
  console.log('  Recommendation Engine');
  console.log('    ✓ ContentRecommendation   – shown/clicked/completed/ignored states');
  console.log('    ✓ StudentTopicMastery     – weak subjects drive WEAK_SUBJECT_BOOST signal');
  console.log('    ✓ StudentLearningProfile  – weakSubjects array populated for 2 students');
  console.log('    ✓ StructuredSession       – incomplete sessions trigger RESUME_SESSION signal');
  console.log('');
  console.log('  Session & Homework');
  console.log('    ✓ StructuredSession       – COMPLETE / PRACTICE / HOMEWORK / EXPIRED states');
  console.log('    ✓ SessionEvent            – full event trail for completed sessions');
  console.log('    ✓ HomeworkAssignment      – PENDING / OVERDUE / SUBMITTED / GRADED');
  console.log('    ✓ HomeworkAnswer          – answers seeded for submitted/graded HW');
  console.log('');
  console.log('HOW TO TEST');
  console.log('──────────────────────────────────────');
  console.log('  1. Start dev server: npm run dev');
  console.log('  2. Log in as each student (use a magic-link or set a password via Prisma Studio)');
  console.log('     • /dashboard      → Student dashboard');
  console.log('     • /parent/dashboard → Parent dashboard (log in as parent account)');
  console.log('  3. Recommendation API smoke test:');
  console.log('     GET /api/recommendations?userId=<arjun-id>');
  console.log('     Expected: ≥2 items, weak-subject topics ranked high');
  console.log('  4. Check Prisma Studio for full data inspection:');
  console.log('     npx prisma studio');
  console.log('');
  if (report.warnings.length > 0) {
    console.log('WARNINGS');
    console.log('──────────────────────────────────────');
    for (const w of report.warnings) console.log(`  ⚠  ${w}`);
    console.log('');
  }
  console.log('NEXT STEPS (if anything is broken)');
  console.log('──────────────────────────────────────');
  console.log('  • If board/class not found → run:  node scripts/seed-ai-content.cjs');
  console.log('  • If Science/Math missing   → run:  node scripts/seed-ai-data.cjs');
  console.log('  • For full reset            → run:  npx prisma migrate reset --force');
  console.log('    then re-run all three seed scripts in order.');
  console.log('');
  console.log('  Seed script: scripts/seed-dashboard-test-data.cjs');
  console.log('  Branch:      claude/seed-dashboard-test-data-CNWd7');
  console.log('');
}

// ── entry point ───────────────────────────────────────────────────────────────
main()
  .catch(err => {
    console.error('\n[FATAL] seed-dashboard-test-data failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    if (prisma) await prisma.$disconnect();
  });
