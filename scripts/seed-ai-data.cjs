/**
 * seed-ai-data.cjs
 *
 * Populates realistic dummy curriculum data for local development
 * so we never need to call OpenAI during dev/container deploys.
 *
 * Scope: CBSE, Grade 10 (Mathematics + Science)
 *   - Board + ClassLevel
 *   - 2 SubjectDef
 *   - 27 ChapterDef (14 Maths, 13 Science)
 *   - 3 topics per chapter (~81 TopicDef)
 *   - 3 concepts per topic (~243 Concept)
 *   - 5 MCQs per concept (~1215 Question)  [stored in Question table; concept metadata embedded in choices JSON]
 *   - 27 BoardChapterWeight
 *   - 2–3 CurriculumChunk per chapter (~60–80)  [dummy content + conceptIds tags]
 *
 * Idempotent: uses upsert wherever possible.
 *
 * Usage:  node scripts/seed-ai-data.cjs
 */

const fs = require('fs');
const path = require('path');

// ── env loader (reused pattern from other scripts) ──────────────────────────
function loadEnvFileIfPresent() {
  try {
    const root = path.resolve(__dirname, '..');
    for (const name of ['.env.local', '.env']) {
      const p = path.join(root, name);
      if (!fs.existsSync(p)) continue;
      const raw = fs.readFileSync(p, 'utf8');
      for (let line of raw.split(/\r?\n/)) {
        line = line.trim();
        if (!line || line.startsWith('#')) continue;
        const m = line.match(/^([^=\s]+)=((?:".*")|(?:'.*')|.*)$/);
        if (!m) continue;
        const key = m[1];
        let val = m[2];
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
          val = val.slice(1, -1);
        if (!process.env[key]) process.env[key] = val;
      }
      console.log(`[env-loader] loaded ${p}`);
      break;
    }
  } catch (e) {
    console.warn('[env-loader]', e && e.message);
  }
}
loadEnvFileIfPresent();
// Allow safe dry-run without initializing Prisma client
const DRY_RUN = process.argv.includes('--dry-run');
let prisma = null;
if (!DRY_RUN) {
  const { PrismaClient } = require('@prisma/client');
  prisma = new PrismaClient();
}

// ============================================================================
// DATA DEFINITIONS
// ============================================================================

const BOARD_SLUG = 'cbse';
const GRADE = 10;
const BOARD_NAME = 'CBSE';
const BOARD_COUNTRY = 'IN'; // Prisma Board model does not store country; kept for seed intent.
const SEED_SOURCE = 'seed-cbse-g10-v1';

const SUBJECTS = [
  { name: 'Mathematics', slug: 'math' },
  { name: 'Science', slug: 'science' },
];

const MATH_CHAPTERS = [
  { name: 'Real Numbers', weightMarks: 6 },
  { name: 'Polynomials', weightMarks: 5 },
  { name: 'Pair of Linear Equations in Two Variables', weightMarks: 8 },
  { name: 'Quadratic Equations', weightMarks: 8 },
  { name: 'Arithmetic Progressions', weightMarks: 5 },
  { name: 'Triangles', weightMarks: 7 },
  { name: 'Coordinate Geometry', weightMarks: 6 },
  { name: 'Introduction to Trigonometry', weightMarks: 7 },
  { name: 'Applications of Trigonometry', weightMarks: 7 },
  { name: 'Circles', weightMarks: 5 },
  { name: 'Areas Related to Circles', weightMarks: 5 },
  { name: 'Surface Areas and Volumes', weightMarks: 6 },
  { name: 'Statistics', weightMarks: 5 },
  { name: 'Probability', weightMarks: 5 },
];

const SCIENCE_CHAPTERS = [
  { name: 'Chemical Reactions and Equations', weightMarks: 7 },
  { name: 'Acids, Bases and Salts', weightMarks: 7 },
  { name: 'Metals and Non-metals', weightMarks: 7 },
  { name: 'Carbon and its Compounds', weightMarks: 6 },
  { name: 'Life Processes', weightMarks: 7 },
  { name: 'Control and Coordination', weightMarks: 6 },
  { name: 'How do Organisms Reproduce', weightMarks: 6 },
  { name: 'Heredity and Evolution', weightMarks: 5 },
  { name: 'Light — Reflection and Refraction', weightMarks: 7 },
  { name: 'The Human Eye and the Colourful World', weightMarks: 5 },
  { name: 'Electricity', weightMarks: 7 },
  { name: 'Magnetic Effects of Electric Current', weightMarks: 5 },
  { name: 'Our Environment', weightMarks: 5 },
];

// ============================================================================
// HELPERS
// ============================================================================

function slugify(input) {
  return String(input)
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

function bloomForIndex(i) {
  const levels = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
  return levels[i % levels.length];
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function pickDifficultyByIrt(irt_b) {
  if (irt_b <= -0.5) return 'easy';
  if (irt_b <= 0.5) return 'medium';
  return 'hard';
}

function irtByConceptType(kind) {
  if (kind === 'recall') return -1.0;
  if (kind === 'apply') return 0.0;
  return 1.0; // multi-step / proof-ish
}

function conceptDescription(subjectName, chapterName, topicName, conceptName) {
  // 2–3 sentence pedagogical definition (dummy but real instructional content).
  return (
    `${conceptName} is a key idea in ${topicName} (${chapterName}) for Class ${GRADE} ${subjectName}. ` +
    `It explains what the term means, when it is used, and how it connects to typical CBSE-style problems. ` +
    `Being clear about this concept helps students avoid common mistakes and choose the right method quickly.`
  );
}

function topicsForChapter(subjectSlug, chapterName) {
  // Always return 3 topics per chapter (meets ">=3 topics per chapter").
  const c = chapterName;
  const isMath = subjectSlug === 'math';
  const isSci = subjectSlug === 'science';

  const presets = {
    'Quadratic Equations': [
      'Standard form and coefficients',
      'Factorisation method',
      'Discriminant and nature of roots',
    ],
    Electricity: ['Electric current and circuits', "Ohm’s Law", 'Series and parallel circuits'],
    'Life Processes': ['Nutrition', 'Respiration', 'Transportation and excretion'],
    'Chemical Reactions and Equations': ['Types of reactions', 'Balancing equations', 'Oxidation and reduction'],
    Polynomials: ['Zeros of a polynomial', 'Relationship between zeros and coefficients', 'Polynomial division algorithm'],
    'Real Numbers': ["Euclid’s Division Lemma", 'Fundamental Theorem of Arithmetic', 'HCF and LCM of numbers'],
    'Pair of Linear Equations in Two Variables': ['Graphical method', 'Substitution method', 'Elimination method'],
    'Arithmetic Progressions': ['nth term of an AP', 'Sum of n terms', 'AP in word problems'],
    Triangles: ['Similarity of triangles', 'Pythagoras theorem and converse', 'Area ratio theorems'],
    'Coordinate Geometry': ['Distance formula', 'Section formula', 'Area of triangle'],
    'Introduction to Trigonometry': ['Trigonometric ratios', 'Values at special angles', 'Trigonometric identities'],
    'Applications of Trigonometry': ['Heights and distances', 'Angle of elevation/depression', 'Choosing reference angle'],
    Circles: ['Tangent properties', 'Number of tangents', 'Tangent-secant ideas'],
    'Areas Related to Circles': ['Arc length', 'Sector area', 'Composite area problems'],
    'Surface Areas and Volumes': ['Surface area of solids', 'Volume of solids', 'Combination of solids'],
    Statistics: ['Mean of grouped data', 'Median and mode', 'Ogive and interpretation'],
    Probability: ['Experimental probability', 'Theoretical probability', 'Simple events'],
    'Acids, Bases and Salts': ['Indicators and pH', 'Neutralisation', 'Salts and their uses'],
    'Metals and Non-metals': ['Physical and chemical properties', 'Reactivity series and displacement', 'Corrosion and prevention'],
    'Carbon and its Compounds': ['Covalent bonding', 'Hydrocarbons and functional groups', 'Soaps and detergents'],
    'Control and Coordination': ['Nervous system', 'Reflex action', 'Hormones and feedback'],
    'How do Organisms Reproduce': ['Asexual reproduction', 'Sexual reproduction', 'Reproductive health and heredity basics'],
    'Heredity and Evolution': ['Traits and inheritance', 'Mendel’s experiments (overview)', 'Evolution and speciation'],
    'Light — Reflection and Refraction': ['Laws of reflection', 'Refraction and refractive index', 'Lenses and image formation'],
    'The Human Eye and the Colourful World': ['Structure of the eye', 'Defects and correction', 'Dispersion and scattering'],
    'Magnetic Effects of Electric Current': ['Magnetic field and field lines', 'Fleming’s rules', 'Electric motor and generator basics'],
    'Our Environment': ['Ecosystem and trophic levels', 'Food chains and webs', 'Ozone layer and waste management'],
  };

  if (presets[c]) return presets[c];

  // Fallbacks that are still meaningful, not placeholders.
  if (isMath) return [`Core ideas in ${c}`, `Standard problem types in ${c}`, `Common errors in ${c}`];
  if (isSci) return [`Key definitions in ${c}`, `Important processes in ${c}`, `Applications of ${c}`];
  return [`Overview of ${c}`, `Key examples in ${c}`, `Practice patterns in ${c}`];
}

function conceptsForTopic(topicName) {
  // Exactly 3 concepts per topic: recall / apply / multi-step.
  const base = topicName.replace(/\s+/g, ' ').trim();
  return [
    { kind: 'recall', name: `Definition and key terms for ${base}` },
    { kind: 'apply', name: `Applying ${base} to standard CBSE problems` },
    { kind: 'multi', name: `Multi-step reasoning with ${base}` },
  ];
}

function mcqTemplates(concept, ctx) {
  const { subjectSlug, subjectName, chapterName, topicName } = ctx;
  const bloom = concept.bloomLevel;
  const conceptName = concept.name;

  const optionsBase = (correct, distractors) => {
    const all = [correct, ...distractors].slice(0, 4);
    // ensure 4 options deterministically (pad with plausible distractor variants)
    while (all.length < 4) all.push(`None of the above related to ${topicName}`);
    return all;
  };

  // 5 questions per concept (mix of remember/understand/apply).
  const q1 = {
    text: `In CBSE Class ${GRADE} ${subjectName}, which statement best defines "${conceptName}"?`,
    options: optionsBase(
      `It describes a correct, syllabus-aligned idea used in ${topicName}.`,
      [
        `It is unrelated to ${chapterName}.`,
        `It is a definition from a different subject.`,
        `It is an experimental procedure not used at this level.`,
      ]
    ),
    answer: `It describes a correct, syllabus-aligned idea used in ${topicName}.`,
    explanation: `The best option is the one that matches how ${conceptName} is used within ${topicName} in the Class ${GRADE} syllabus.`,
    bloomLevel: bloom,
  };

  const q2 = {
    text: `A student is solving a problem from "${topicName}" in "${chapterName}". Which step is most appropriate when using "${conceptName}"?`,
    options: optionsBase(
      `Identify given data, choose the relevant relation/definition, and substitute carefully.`,
      [
        `Ignore the given values and guess the result.`,
        `Change units randomly to make numbers simpler.`,
        `Use an unrelated formula without checking conditions.`,
      ]
    ),
    answer: `Identify given data, choose the relevant relation/definition, and substitute carefully.`,
    explanation: `CBSE problems reward method: read givens, verify conditions, then apply the correct relation for ${conceptName}.`,
    bloomLevel: 'apply',
  };

  const q3 = {
    text: `Which of the following is a common mistake students make about "${conceptName}" in "${topicName}"?`,
    options: optionsBase(
      `Using the idea without checking its conditions/assumptions.`,
      [
        `Always writing the answer without units (even when required).`,
        `Never reading the question statement.`,
        `Only solving problems verbally without any steps.`,
      ]
    ),
    answer: `Using the idea without checking its conditions/assumptions.`,
    explanation: `Most conceptual errors happen when conditions are skipped; checking assumptions prevents wrong conclusions.`,
    bloomLevel: 'analyze',
  };

  const q4 = {
    text: `In a multi-step problem from "${chapterName}", why is "${conceptName}" useful?`,
    options: optionsBase(
      `It helps structure the solution by narrowing the correct method and linking steps logically.`,
      [
        `It replaces all calculations.`,
        `It guarantees the final answer is always an integer.`,
        `It removes the need to show working.`,
      ]
    ),
    answer: `It helps structure the solution by narrowing the correct method and linking steps logically.`,
    explanation: `Multi-step questions test planning; using the right concept at the right time keeps steps consistent.`,
    bloomLevel: 'understand',
  };

  const q5 = {
    text: `Which option best connects "${conceptName}" to real CBSE exam performance for ${subjectSlug} ${GRADE}?`,
    options: optionsBase(
      `It improves accuracy by making the method explicit and reducing avoidable mistakes.`,
      [
        `It is only memorisation and never used.`,
        `It is too advanced for Class ${GRADE}.`,
        `It is only useful for oral questions.`,
      ]
    ),
    answer: `It improves accuracy by making the method explicit and reducing avoidable mistakes.`,
    explanation: `Concept clarity reduces wrong-method errors, which are common in timed exams.`,
    bloomLevel: 'evaluate',
  };

  return [q1, q2, q3, q4, q5];
}

async function upsertConcept(tx, data) {
  const existing = await tx.concept.findFirst({
    where: { topicId: data.topicId, name: data.name },
    select: { id: true },
  });
  if (existing) {
    return tx.concept.update({
      where: { id: existing.id },
      data: {
        subjectId: data.subjectId,
        description: data.description,
        irt_b: data.irt_b,
        bloomLevel: data.bloomLevel,
        prerequisiteConceptIds: data.prerequisiteConceptIds || [],
        commonlyConfusedWithIds: data.commonlyConfusedWithIds || [],
      },
    });
  }
  return tx.concept.create({ data });
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('=== seed-ai-data: populating dev content for CBSE Grade 10 ===\n');

  // DRY_RUN already declared at top-level to avoid Prisma initialization during dry runs

  // 1) Upsert board + class level.
  let board;
  let classLevel;
  if (DRY_RUN) {
    console.log('[DRY RUN] Board/ClassLevel: would upsert');
    board = { id: 'dry-board', name: BOARD_NAME, slug: BOARD_SLUG, country: BOARD_COUNTRY };
    classLevel = { id: 'dry-class', grade: GRADE, boardId: board.id };
  } else {
    board = await prisma.board.upsert({
      where: { slug: BOARD_SLUG },
      update: { name: BOARD_NAME },
      create: { name: BOARD_NAME, slug: BOARD_SLUG },
    });
    classLevel = await prisma.classLevel.upsert({
      where: { boardId_grade: { boardId: board.id, grade: GRADE } },
      update: { slug: `grade-${GRADE}` },
      create: { boardId: board.id, grade: GRADE, slug: `grade-${GRADE}` },
    });
  }
  console.log(`Board: ${board.name} (${board.id}) | Class: Grade ${GRADE} (${classLevel.id})\n`);

  // 2) Upsert subjects.
  const subjectBySlug = new Map();
  for (const s of SUBJECTS) {
    if (DRY_RUN) {
      console.log(`[DRY RUN] SubjectDef: upsert ${s.name} (slug=${s.slug})`);
      subjectBySlug.set(s.slug, { id: `dry-subject-${s.slug}`, name: s.name, slug: s.slug });
      continue;
    }
    const subj = await prisma.subjectDef.upsert({
      where: { classId_slug: { classId: classLevel.id, slug: s.slug } },
      update: { name: s.name },
      create: { classId: classLevel.id, name: s.name, slug: s.slug },
    });
    subjectBySlug.set(s.slug, subj);
    console.log(`Subject: ${subj.name} (${subj.id})`);
  }
  console.log('');

  const chapterPlans = [
    ...MATH_CHAPTERS.map((c, idx) => ({ ...c, orderIndex: idx + 1, subjectSlug: 'math' })),
    ...SCIENCE_CHAPTERS.map((c, idx) => ({ ...c, orderIndex: idx + 1, subjectSlug: 'science' })),
  ];

  // 3+) Upsert chapters, topics, concepts, questions, weights, chunks.
  for (const plan of chapterPlans) {
    const subject = subjectBySlug.get(plan.subjectSlug);
    if (!subject) throw new Error(`Missing subject slug: ${plan.subjectSlug}`);

    const chapterSlug = slugify(plan.name);
    const chapterName = plan.name;

    if (DRY_RUN) {
      console.log(`[DRY RUN] ChapterDef: upsert ${chapterName} (slug=${chapterSlug}, order=${plan.orderIndex})`);
      console.log(`[DRY RUN] BoardChapterWeight: upsert ${plan.weightMarks} marks`);
      const topicNames = topicsForChapter(plan.subjectSlug, chapterName);
      topicNames.forEach((tn, i) => {
        const ts = slugify(tn);
        console.log(`  [DRY RUN] TopicDef: upsert ${tn} (slug=${ts}, order=${i + 1})`);
        const conceptSeeds = conceptsForTopic(tn);
        conceptSeeds.forEach((cs, j) => {
          console.log(`    [DRY RUN] Concept: upsert ${cs.name} (bloom=${bloomForIndex(j)}, irt=${irtByConceptType(cs.kind)})`);
          console.log(`      [DRY RUN] Questions: seed 5 MCQs for concept`);
        });
      });
      console.log(`  [DRY RUN] CurriculumChunk: seed 2–3 dummy chunks tagged with conceptIds\n`);
      continue;
    }

    // No transaction wrapper — seed ops are idempotent; tx timeout (P2028) avoided by using prisma directly
    await (async () => {
      const tx = prisma;
      const chapter = await tx.chapterDef.upsert({
        where: { subjectId_slug_version: { subjectId: subject.id, slug: chapterSlug, version: 1 } },
        update: { name: chapterName, order: plan.orderIndex, status: 'approved' },
        create: {
          subjectId: subject.id,
          name: chapterName,
          slug: chapterSlug,
          order: plan.orderIndex,
          version: 1,
          status: 'approved',
        },
      });

      await tx.boardChapterWeight.upsert({
        where: { chapterId: chapter.id },
        update: { weightMarks: plan.weightMarks },
        create: { chapterId: chapter.id, weightMarks: plan.weightMarks },
      });

      const topicNames = topicsForChapter(plan.subjectSlug, chapterName);
      const topicRows = [];
      const conceptRows = [];

      for (let i = 0; i < topicNames.length; i++) {
        const topicName = topicNames[i];
        const topicSlug = slugify(topicName);
        const topic = await tx.topicDef.upsert({
          where: { chapterId_slug: { chapterId: chapter.id, slug: topicSlug } },
          update: { name: topicName, order: i + 1, status: 'approved' },
          create: { chapterId: chapter.id, name: topicName, slug: topicSlug, order: i + 1, status: 'approved' },
        });
        topicRows.push(topic);

        const conceptSeeds = conceptsForTopic(topicName);
        for (let j = 0; j < conceptSeeds.length; j++) {
          const cs = conceptSeeds[j];
          const bloomLevel = bloomForIndex(j);
          const irt_b = irtByConceptType(cs.kind);
          const concept = await upsertConcept(tx, {
            topicId: topic.id,
            subjectId: subject.id,
            name: cs.name,
            description: conceptDescription(subject.name, chapterName, topicName, cs.name),
            irt_b,
            bloomLevel,
            prerequisiteConceptIds: [],
            commonlyConfusedWithIds: [],
          });
          conceptRows.push({ concept, topic, chapter });
        }
      }

      // Idempotent concept-question seeding:
      // - "Question" table is topic-based in this repo; we seed 5 MCQs per concept and store concept metadata inside `choices`.
      // - We delete & recreate only rows we own (source=SEED_SOURCE) per topic.
      for (const topic of topicRows) {
        await tx.question.deleteMany({ where: { topicId: topic.id, source: SEED_SOURCE } });
      }

      for (const { concept, topic } of conceptRows) {
        const qIrtBase = concept.irt_b ?? 0.0;
        const templates = mcqTemplates(
          { id: concept.id, name: concept.name, bloomLevel: concept.bloomLevel || 'understand' },
          {
            subjectSlug: plan.subjectSlug,
            subjectName: subject.name,
            chapterName,
            topicName: topic.name,
          }
        );

        const payload = templates.map((t, idx) => {
          const jitter = (idx - 2) * 0.15;
          const irt = clamp(qIrtBase + jitter, -1.5, 2.0);
          const difficulty = pickDifficultyByIrt(irt);
          return {
            board: BOARD_SLUG,
            subject: plan.subjectSlug,
            grade: String(GRADE),
            chapter: chapterName,
            topicId: topic.id,
            type: 'mcq',
            difficulty,
            irt_b: irt,
            prompt: t.text,
            choices: {
              options: t.options,
              explanation: t.explanation,
              bloomLevel: t.bloomLevel,
              conceptId: concept.id,
              conceptName: concept.name,
              topicName: topic.name,
              chapterName,
              seedSource: SEED_SOURCE,
            },
            correctAnswer: t.answer,
            source: SEED_SOURCE,
          };
        });

        // createMany is faster but we want explicit data shape per row.
        for (const row of payload) {
          await tx.question.create({ data: row });
        }
      }

      // Curriculum chunks: 2–3 dummy chunks per chapter, tagged with 1–3 conceptIds.
      // We own chunks whose content starts with "dummy-seed|SEED_SOURCE|".
      const chunkPrefix = `dummy-seed|${SEED_SOURCE}|${plan.subjectSlug}|${chapterSlug}|`;
      await tx.curriculumChunk.deleteMany({
        where: {
          board: BOARD_SLUG,
          subject: plan.subjectSlug,
          grade: String(GRADE),
          content: { startsWith: chunkPrefix },
        },
      });

      const chapterConceptIds = conceptRows.map((x) => x.concept.id);
      const chunkCount = chapterConceptIds.length >= 9 ? 3 : 2;
      for (let k = 0; k < chunkCount; k++) {
        const slice = chapterConceptIds.slice(k * 3, k * 3 + 3);
        const chosen = slice.length ? slice : chapterConceptIds.slice(0, 3);
        const content =
          `${chunkPrefix}${k + 1}\n` +
          `This chunk summarises key ideas from "${chapterName}" (${subject.name}, Class ${GRADE}). ` +
          `It highlights definitions, standard methods, and a typical reasoning pattern students apply in exam questions. ` +
          `Use it as dummy grounding text for local RAG filtering by concept tags.`;

        await tx.curriculumChunk.create({
          data: {
            board: BOARD_SLUG,
            subject: plan.subjectSlug,
            grade: String(GRADE),
            conceptIds: chosen,
            content,
          },
        });
      }
    })();

    console.log(
      `Seeded: [${plan.subjectSlug}] ${chapterName} | topics=3 | concepts=9 | questions=45 | weight=${plan.weightMarks} | chunks=2–3`
    );
  }

  console.log('=== seed-ai-data: DONE ===');
}

main()
  .catch((err) => {
    console.error('seed-ai-data FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    if (prisma && typeof prisma.$disconnect === 'function') {
      await prisma.$disconnect();
    }
  });
