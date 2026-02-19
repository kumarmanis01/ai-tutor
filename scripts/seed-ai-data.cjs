/**
 * seed-ai-data.cjs
 *
 * Populates realistic dummy AI-generated content for local development
 * so we never need to call OpenAI during dev/container deploys.
 *
 * Scope: CBSE, English, Grade 10
 *   - 2 Subjects  (Science, Mathematics)
 *   - 2 Chapters per subject
 *   - 2 Topics per chapter
 *   - 1 TopicNote per topic  (enhanced-schema JSON)
 *   - 3 GeneratedTests per topic (easy / medium / hard), 2 questions each
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

// Helper: perform an idempotent upsert inside a transaction.
// Use deterministic keys (slug / externalId) when calling this helper.
async function txUpsert(tx, modelName, where, createData, updateData) {
  // modelName unused in code-level but kept for readability in call sites
  const model = tx;
  // Prisma dynamic model access is not directly supported without eval;
  // callers should pass the appropriate tx.<model> function instead.
  // Example usage:
  // await txUpsert(prisma, 'lesson', (tx) => tx.lesson, { where }, createData, updateData)
  return null;
}

// ============================================================================
// DATA DEFINITIONS
// ============================================================================

const BOARD_SLUG = 'cbse';
const GRADE = 10;

const SUBJECTS = [
  {
    name: 'Science',
    slug: 'science',
    chapters: [
      {
        name: 'Electricity',
        slug: 'electricity',
        order: 1,
        topics: [
          {
            name: 'Electric Current and Circuit',
            slug: 'electric-current-and-circuit',
            order: 1,
            note: buildNote(
              'Electric Current and Circuit',
              'Electric current is the rate of flow of electric charge through a conductor. It is measured in amperes (A). A complete electric circuit provides a closed path for current to flow from the positive terminal of a battery, through the components, and back to the negative terminal.',
              [
                {
                  heading: 'What is Electric Current?',
                  explanation: 'Electric current is the flow of electrons through a conductor. When a potential difference (voltage) is applied across a conductor, the free electrons move in a specific direction, creating current. The SI unit of current is ampere (A), named after André-Marie Ampère. Mathematically, I = Q/t, where I is current, Q is charge in coulombs, and t is time in seconds.',
                  keyTakeaway: 'Current = Charge / Time  →  I = Q/t',
                },
                {
                  heading: 'Electric Circuit Components',
                  explanation: 'An electric circuit consists of a source of energy (cell/battery), connecting wires, a switch, and a load (bulb, resistor). When the switch is closed, the circuit is complete and current flows. When open, the circuit is broken and no current flows. Circuit diagrams use standard symbols: a long and short line for a cell, a cross in a circle for a bulb, and two parallel lines for an open switch.',
                  keyTakeaway: 'A closed circuit allows current flow; an open circuit stops it.',
                },
              ],
              [
                { term: 'Ampere', definition: 'SI unit of electric current; 1 A = 1 coulomb per second.', example: 'A torch bulb draws about 0.5 A.' },
                { term: 'Coulomb', definition: 'SI unit of electric charge; charge of about 6.24 × 10¹⁸ electrons.', example: '1 C of charge flows through a wire carrying 1 A in 1 second.' },
              ],
              [
                { scenario: 'When you switch on a torch, the batteries push electrons through the bulb filament.', connection: 'The battery provides the potential difference and the closed switch completes the circuit, allowing current to flow and the bulb to glow.' },
              ]
            ),
          },
          {
            name: "Ohm's Law and Resistance",
            slug: 'ohms-law-and-resistance',
            order: 2,
            note: buildNote(
              "Ohm's Law and Resistance",
              "Ohm's Law states that the current flowing through a conductor is directly proportional to the potential difference across it, provided the temperature remains constant. The constant of proportionality is called resistance.",
              [
                {
                  heading: "Ohm's Law",
                  explanation: "Georg Simon Ohm discovered that at constant temperature, the current (I) through a metallic conductor is directly proportional to the potential difference (V) across its ends. This gives us V = IR, where R is the resistance of the conductor measured in ohms (Ω). The V-I graph for an ohmic conductor is a straight line passing through the origin.",
                  keyTakeaway: 'V = I × R  (Voltage = Current × Resistance)',
                },
                {
                  heading: 'Resistance and Factors Affecting It',
                  explanation: 'Resistance is the property of a conductor that opposes the flow of current. It depends on four factors: (1) length of the conductor – R ∝ l, (2) cross-sectional area – R ∝ 1/A, (3) nature of the material (resistivity ρ), and (4) temperature. The formula is R = ρl/A. Good conductors like copper have low resistivity; insulators like rubber have very high resistivity.',
                  keyTakeaway: 'R = ρl/A — longer wires have more resistance, thicker wires have less.',
                },
              ],
              [
                { term: 'Ohm (Ω)', definition: 'SI unit of resistance; 1 Ω = 1 V/A.', example: 'A 100 W bulb at 220 V has resistance of 484 Ω.' },
                { term: 'Resistivity (ρ)', definition: 'Intrinsic property of a material that quantifies its resistance per unit length and area.', example: 'Copper ρ ≈ 1.7 × 10⁻⁸ Ω·m, Nichrome ρ ≈ 1.1 × 10⁻⁴ Ω·m.' },
              ],
              [
                { scenario: 'Electric heaters use nichrome wire because of its high resistivity.', connection: 'High resistance converts more electrical energy to heat, which is the purpose of a heater.' },
              ]
            ),
          },
        ],
      },
      {
        name: 'Chemical Reactions and Equations',
        slug: 'chemical-reactions-and-equations',
        order: 2,
        topics: [
          {
            name: 'Types of Chemical Reactions',
            slug: 'types-of-chemical-reactions',
            order: 1,
            note: buildNote(
              'Types of Chemical Reactions',
              'Chemical reactions are processes in which one or more substances are converted into new substances. They can be classified based on the nature of the change: combination, decomposition, displacement, double displacement, and redox reactions.',
              [
                {
                  heading: 'Combination and Decomposition Reactions',
                  explanation: 'In a combination reaction, two or more reactants combine to form a single product. Example: 2Mg + O₂ → 2MgO (burning magnesium ribbon). In a decomposition reaction, a single reactant breaks down into two or more products. Example: 2FeSO₄ → Fe₂O₃ + SO₂ + SO₃ (heating ferrous sulphate). Decomposition can be triggered by heat (thermal), light (photolytic), or electricity (electrolytic).',
                  keyTakeaway: 'Combination: A + B → AB  |  Decomposition: AB → A + B',
                },
                {
                  heading: 'Displacement and Double Displacement',
                  explanation: 'In a displacement reaction, a more reactive element displaces a less reactive element from its compound. Example: Fe + CuSO₄ → FeSO₄ + Cu (iron displaces copper). In double displacement, ions of two compounds exchange partners. Example: Na₂SO₄ + BaCl₂ → BaSO₄↓ + 2NaCl. Double displacement reactions often produce a precipitate, gas, or water.',
                  keyTakeaway: 'Displacement: A + BC → AC + B  |  Double displacement: AB + CD → AD + CB',
                },
              ],
              [
                { term: 'Precipitate', definition: 'An insoluble solid formed during a chemical reaction in solution.', example: 'BaSO₄ forms as a white precipitate when BaCl₂ reacts with Na₂SO₄.' },
                { term: 'Reactivity Series', definition: 'A list of metals arranged in order of decreasing reactivity.', example: 'K > Na > Ca > Mg > Al > Zn > Fe > Cu > Ag > Au' },
              ],
              [
                { scenario: 'Rusting of iron gates and grills is a slow chemical reaction.', connection: 'Iron reacts with oxygen and moisture: 4Fe + 3O₂ + 6H₂O → 4Fe(OH)₃, which forms rust (Fe₂O₃·xH₂O). This is a combination + oxidation reaction.' },
              ]
            ),
          },
          {
            name: 'Balancing Chemical Equations',
            slug: 'balancing-chemical-equations',
            order: 2,
            note: buildNote(
              'Balancing Chemical Equations',
              'A balanced chemical equation has an equal number of atoms of each element on both sides, following the Law of Conservation of Mass. Balancing is essential to accurately represent what happens in a reaction.',
              [
                {
                  heading: 'Steps to Balance an Equation',
                  explanation: 'Step 1: Write the unbalanced equation with correct formulae. Step 2: List the number of atoms of each element on both sides. Step 3: Start balancing the element that appears in the fewest formulae. Step 4: Use coefficients (not subscripts) to balance. Step 5: Verify all elements are balanced. Example: Fe + H₂O → Fe₃O₄ + H₂ becomes 3Fe + 4H₂O → Fe₃O₄ + 4H₂.',
                  keyTakeaway: 'Never change subscripts in formulae — only adjust coefficients.',
                },
                {
                  heading: 'Writing Complete Equations',
                  explanation: 'A complete balanced equation includes: (1) correct formulae of reactants and products, (2) balanced coefficients, (3) physical states — (s) solid, (l) liquid, (g) gas, (aq) aqueous. Example: Zn(s) + H₂SO₄(aq) → ZnSO₄(aq) + H₂(g)↑. The arrow (→) means "yields" or "produces". Conditions like heat (Δ) or catalyst are written above the arrow.',
                  keyTakeaway: 'Include physical states (s, l, g, aq) and reaction conditions for completeness.',
                },
              ],
              [
                { term: 'Coefficient', definition: 'A number placed before a formula to balance the equation.', example: '3Fe means 3 atoms of iron.' },
                { term: 'Law of Conservation of Mass', definition: 'Mass can neither be created nor destroyed in a chemical reaction.', example: 'In 2H₂ + O₂ → 2H₂O, 4g + 32g = 36g on both sides.' },
              ],
              [
                { scenario: 'When baking soda and vinegar are mixed, bubbles form.', connection: 'NaHCO₃ + CH₃COOH → CH₃COONa + H₂O + CO₂↑. The CO₂ gas causes the fizzing. Both sides have the same atoms — the equation is balanced.' },
              ]
            ),
          },
        ],
      },
    ],
  },
  {
    name: 'Mathematics',
    slug: 'mathematics',
    chapters: [
      {
        name: 'Real Numbers',
        slug: 'real-numbers',
        order: 1,
        topics: [
          {
            name: "Euclid's Division Lemma",
            slug: 'euclids-division-lemma',
            order: 1,
            note: buildNote(
              "Euclid's Division Lemma",
              "Euclid's Division Lemma is a fundamental theorem in number theory. For any two positive integers a and b, there exist unique integers q and r such that a = bq + r, where 0 ≤ r < b. This lemma is the basis for finding the HCF of two numbers.",
              [
                {
                  heading: "Understanding Euclid's Division Lemma",
                  explanation: "Given two positive integers a (dividend) and b (divisor), we can always find unique integers q (quotient) and r (remainder) such that a = bq + r, where 0 ≤ r < b. For example, if a = 17 and b = 5, then 17 = 5 × 3 + 2, so q = 3 and r = 2. This is not just division — it guarantees existence and uniqueness of q and r.",
                  keyTakeaway: 'a = bq + r, where 0 ≤ r < b. The remainder is always non-negative and less than the divisor.',
                },
                {
                  heading: "Euclid's Division Algorithm for HCF",
                  explanation: "To find HCF(a, b) where a > b: Step 1: Apply the lemma: a = bq + r. Step 2: If r = 0, then HCF = b. Step 3: If r ≠ 0, replace a with b and b with r, repeat. Example: HCF(420, 130): 420 = 130 × 3 + 30, then 130 = 30 × 4 + 10, then 30 = 10 × 3 + 0. So HCF = 10.",
                  keyTakeaway: 'Keep dividing until remainder = 0. The last non-zero remainder is the HCF.',
                },
              ],
              [
                { term: 'Lemma', definition: 'A proven statement used as a stepping stone to prove other statements.', example: "Euclid's Division Lemma is used to prove the Fundamental Theorem of Arithmetic." },
                { term: 'HCF', definition: 'Highest Common Factor — the largest number that divides two or more numbers exactly.', example: 'HCF(12, 18) = 6.' },
              ],
              [
                { scenario: 'A school has 420 red and 130 blue balloons to be divided into identical groups.', connection: 'We need HCF(420, 130) = 10. So we can make 10 groups with 42 red and 13 blue balloons each — Euclid\'s algorithm solves this.' },
              ]
            ),
          },
          {
            name: 'Fundamental Theorem of Arithmetic',
            slug: 'fundamental-theorem-of-arithmetic',
            order: 2,
            note: buildNote(
              'Fundamental Theorem of Arithmetic',
              'Every composite number can be expressed as a product of prime numbers in a unique way, apart from the order of the factors. This is the Fundamental Theorem of Arithmetic, first proved by Carl Friedrich Gauss.',
              [
                {
                  heading: 'Statement and Meaning',
                  explanation: "The theorem states that every integer greater than 1 is either a prime itself or can be uniquely factorised as a product of primes (ignoring order). For example: 420 = 2² × 3 × 5 × 7. No matter how you factorise 420, you always get these same primes. This uniqueness is powerful — it means the primes are the 'building blocks' of all natural numbers.",
                  keyTakeaway: 'Every composite number has a unique prime factorisation.',
                },
                {
                  heading: 'Applications: HCF and LCM using Prime Factorisation',
                  explanation: 'For two numbers a and b, find their prime factorisations. HCF = product of the smallest power of each common prime factor. LCM = product of the greatest power of each prime factor. Example: 12 = 2² × 3, 18 = 2 × 3². HCF = 2¹ × 3¹ = 6, LCM = 2² × 3² = 36. Important property: HCF(a,b) × LCM(a,b) = a × b.',
                  keyTakeaway: 'HCF × LCM = product of the two numbers.',
                },
              ],
              [
                { term: 'Prime Number', definition: 'A number greater than 1 with no factors other than 1 and itself.', example: '2, 3, 5, 7, 11, 13, ...' },
                { term: 'Composite Number', definition: 'A number greater than 1 that has at least one factor other than 1 and itself.', example: '4, 6, 8, 9, 10, 12, ...' },
              ],
              [
                { scenario: 'Finding when two traffic lights that blink every 4s and 6s will blink together.', connection: 'LCM(4, 6) = 12. Using prime factorisation: 4 = 2², 6 = 2 × 3, LCM = 2² × 3 = 12 seconds.' },
              ]
            ),
          },
        ],
      },
      {
        name: 'Pair of Linear Equations in Two Variables',
        slug: 'pair-of-linear-equations',
        order: 2,
        topics: [
          {
            name: 'Graphical Method of Solution',
            slug: 'graphical-method-of-solution',
            order: 1,
            note: buildNote(
              'Graphical Method of Solution',
              'A pair of linear equations in two variables can be solved by plotting both lines on a graph. The point of intersection gives the solution. The lines may intersect (unique solution), be parallel (no solution), or coincide (infinitely many solutions).',
              [
                {
                  heading: 'Representing Equations Graphically',
                  explanation: 'A linear equation ax + by + c = 0 represents a straight line on the coordinate plane. To plot it, find at least two solutions (x, y) and join them. For the pair: x + y = 10 and x − y = 4, rewrite as y = 10 − x and y = x − 4. Plot both lines. The intersection point (7, 3) is the unique solution.',
                  keyTakeaway: 'Plot both lines; the intersection point gives x and y values that satisfy both equations.',
                },
                {
                  heading: 'Conditions for Consistency',
                  explanation: 'For a₁x + b₁y + c₁ = 0 and a₂x + b₂y + c₂ = 0: If a₁/a₂ ≠ b₁/b₂, lines intersect → exactly one solution (consistent). If a₁/a₂ = b₁/b₂ ≠ c₁/c₂, lines are parallel → no solution (inconsistent). If a₁/a₂ = b₁/b₂ = c₁/c₂, lines coincide → infinitely many solutions (dependent).',
                  keyTakeaway: 'Compare ratios a₁/a₂, b₁/b₂, c₁/c₂ to determine the type of solution.',
                },
              ],
              [
                { term: 'Consistent System', definition: 'A system of equations that has at least one solution.', example: 'x + y = 5 and x − y = 1 → solution (3, 2).' },
                { term: 'Inconsistent System', definition: 'A system of equations that has no solution (parallel lines).', example: 'x + y = 5 and 2x + 2y = 12 have no common point.' },
              ],
              [
                { scenario: 'A shopkeeper sells 3 pens and 2 notebooks for ₹80, and 1 pen and 3 notebooks for ₹75.', connection: '3x + 2y = 80 and x + 3y = 75. Plotting both lines on a graph, they intersect at (10, 25). So a pen costs ₹10 and a notebook costs ₹25.' },
              ]
            ),
          },
          {
            name: 'Algebraic Methods – Substitution and Elimination',
            slug: 'algebraic-methods-substitution-elimination',
            order: 2,
            note: buildNote(
              'Algebraic Methods – Substitution and Elimination',
              'When graphical methods are impractical for non-integer solutions, algebraic methods give exact answers. The two main methods are substitution (express one variable in terms of the other) and elimination (add/subtract equations to remove a variable).',
              [
                {
                  heading: 'Substitution Method',
                  explanation: 'Step 1: From one equation, express one variable in terms of the other. Step 2: Substitute into the second equation to get a single-variable equation. Step 3: Solve and back-substitute. Example: x + 2y = 8 … (i), 3x + y = 9 … (ii). From (i): x = 8 − 2y. Substituting in (ii): 3(8 − 2y) + y = 9 → 24 − 6y + y = 9 → y = 3. Then x = 8 − 6 = 2. Solution: (2, 3).',
                  keyTakeaway: 'Isolate one variable, substitute, solve, back-substitute.',
                },
                {
                  heading: 'Elimination Method',
                  explanation: 'Step 1: Multiply one or both equations so that one variable has equal (or opposite) coefficients. Step 2: Add or subtract the equations to eliminate that variable. Step 3: Solve for the remaining variable and substitute back. Example: 2x + 3y = 13 … (i), 4x − 3y = 5 … (ii). Add (i) and (ii): 6x = 18 → x = 3. From (i): 6 + 3y = 13 → y = 7/3.',
                  keyTakeaway: 'Make coefficients equal, then add/subtract to eliminate one variable.',
                },
              ],
              [
                { term: 'Substitution', definition: 'Replacing a variable with an equivalent expression from another equation.', example: 'If x = 5 − y, replace x in the second equation.' },
                { term: 'Elimination', definition: 'Removing a variable by adding or subtracting equations.', example: 'Adding 2x + y = 7 and −2x + 3y = 1 gives 4y = 8.' },
              ],
              [
                { scenario: 'Two friends together have ₹200. If one gives ₹30 to the other, they have equal amounts.', connection: 'x + y = 200, x − 30 = y + 30. By substitution: x − 30 = (200 − x) + 30 → 2x = 260 → x = 130, y = 70.' },
              ]
            ),
          },
        ],
      },
    ],
  },
];

// ============================================================================
// QUESTION BANK  (2 questions × 3 difficulties × each topic)
// ============================================================================

function questionsForTopic(topicSlug, topicName) {
  // Generic well-structured questions keyed by difficulty
  const bank = {
    easy: [
      {
        type: 'mcq',
        question: `Which of the following best describes ${topicName}?`,
        options: ['A fundamental concept in this chapter', 'A concept from a different subject', 'Not part of the CBSE syllabus', 'An advanced college-level topic'],
        answer: 'A fundamental concept in this chapter',
        explanation: `${topicName} is a core concept covered in the CBSE Class 10 curriculum for this chapter.`,
        marks: 1,
      },
      {
        type: 'short_answer',
        question: `Define ${topicName} in one or two sentences.`,
        options: null,
        answer: `${topicName} refers to the key principles and concepts taught in this topic as per the CBSE Class 10 syllabus.`,
        explanation: `A good definition should mention the core idea and its relevance to the chapter.`,
        marks: 2,
      },
    ],
    medium: [
      {
        type: 'mcq',
        question: `A student is studying ${topicName}. Which formula or principle is most directly applicable?`,
        options: ['The primary formula from this topic', 'Pythagoras theorem', 'Archimedes principle', 'Boyle\'s law'],
        answer: 'The primary formula from this topic',
        explanation: `The key formula or principle specific to ${topicName} is the most directly relevant here.`,
        marks: 2,
      },
      {
        type: 'short_answer',
        question: `Explain with an example how ${topicName} is applied in solving a problem.`,
        options: null,
        answer: `Students should demonstrate understanding by applying the core concept of ${topicName} to a numerical or real-world example.`,
        explanation: `Application-based questions test deeper understanding beyond memorisation.`,
        marks: 3,
      },
    ],
    hard: [
      {
        type: 'mcq',
        question: `In a complex problem involving ${topicName}, if the initial conditions are changed, what is the likely effect on the result?`,
        options: ['The result changes proportionally', 'The result stays the same', 'The result becomes zero', 'Cannot be determined without more data'],
        answer: 'The result changes proportionally',
        explanation: `Understanding proportional relationships is key to mastering ${topicName} at a higher level.`,
        marks: 3,
      },
      {
        type: 'short_answer',
        question: `Compare and contrast two different approaches to solving problems in ${topicName}. Which is more efficient and why?`,
        options: null,
        answer: `Students should analyse trade-offs between methods, discussing accuracy, speed, and applicability to different problem types within ${topicName}.`,
        explanation: `Higher-order questions require analysis and evaluation skills.`,
        marks: 4,
      },
    ],
  };
  return bank;
}

// ============================================================================
// HELPER: build enhanced-schema contentJson
// ============================================================================

function buildNote(title, introduction, sections, keyTerms, realWorldExamples) {
  return {
    introduction,
    learningObjectives: sections.map((s) => s.keyTakeaway || `Understand ${s.heading}`),
    sections,
    keyTerms,
    realWorldExamples,
    commonMistakes: [
      { mistake: 'Memorising without understanding the concept.', correction: 'Focus on understanding the "why" behind each step.' },
      { mistake: 'Skipping units and dimensions in answers.', correction: 'Always include correct SI units in your final answer.' },
    ],
    summary: `In this topic you learned about: ${title}. ${introduction.split('.').slice(0, 2).join('.')}.`,
    funFact: `Did you know? This concept was first studied centuries ago and is still used in modern technology every day!`,
    relatedTopics: [],
    studyTips: [
      'Revise the key formulae before attempting problems.',
      'Practice at least 5 numerical problems from this topic.',
      'Draw diagrams wherever possible to visualise the concept.',
    ],
  };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('=== seed-ai-data: populating dev content for CBSE Grade 10 ===\n');

  // DRY_RUN already declared at top-level to avoid Prisma initialization during dry runs

  // 1. Find the board + class (skip DB lookups in dry-run)
  let board;
  let classLevel;
  if (DRY_RUN) {
    console.log('[DRY RUN] Skipping DB lookups for board and classLevel');
    board = { id: 'dry-board', name: BOARD_SLUG };
    classLevel = { id: 'dry-class' };
    console.log(`Board: ${board.name} (${board.id}), Class: Grade ${GRADE} (${classLevel.id})\n`);
  } else {
    board = await prisma.board.findUnique({ where: { slug: BOARD_SLUG } });
    if (!board) {
      console.error(`Board "${BOARD_SLUG}" not found. Run seed-ai-content first.`);
      process.exit(1);
    }

    classLevel = await prisma.classLevel.findUnique({
      where: { boardId_grade: { boardId: board.id, grade: GRADE } },
    });
    if (!classLevel) {
      console.error(`ClassLevel grade ${GRADE} not found for board ${BOARD_SLUG}. Run seed-ai-content first.`);
      process.exit(1);
    }

    console.log(`Board: ${board.name} (${board.id}), Class: Grade ${GRADE} (${classLevel.id})\n`);
  }

  for (const subjectSeed of SUBJECTS) {
    // 2. Upsert SubjectDef (or simulate in dry-run)
    let subject;
    if (DRY_RUN) {
      console.log(`[DRY RUN] Subject: upsert ${subjectSeed.name} (slug=${subjectSeed.slug}) for class ${classLevel.id}`);
      subject = { id: `dry-subj-${subjectSeed.slug}`, name: subjectSeed.name };
    } else {
      subject = await prisma.subjectDef.upsert({
        where: { classId_slug: { classId: classLevel.id, slug: subjectSeed.slug } },
        update: {},
        create: { classId: classLevel.id, name: subjectSeed.name, slug: subjectSeed.slug },
      });
      console.log(`Subject: ${subject.name} (${subject.id})`);
    }

    for (const chapterSeed of subjectSeed.chapters) {
      // Group topic-level writes into a single transaction per chapter to ensure atomicity.
      if (DRY_RUN) {
        console.log(`[DRY RUN] Chapter: upsert ${chapterSeed.name} (slug=${chapterSeed.slug})`);
        for (const topicSeed of chapterSeed.topics) {
          console.log(`  [DRY RUN] Topic: upsert ${topicSeed.name} (slug=${topicSeed.slug})`);
          console.log(`    [DRY RUN] Note: would upsert topic note (en, v1)`);
          const qBank = questionsForTopic(topicSeed.slug, topicSeed.name);
          for (const difficulty of ['easy', 'medium', 'hard']) {
            console.log(`    [DRY RUN] Test [${difficulty}]: would upsert and seed ${qBank[difficulty].length} questions`);
          }
        }
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const chapter = await tx.chapterDef.upsert({
          where: {
            subjectId_slug_version: {
              subjectId: subject.id,
              slug: chapterSeed.slug,
              version: 1,
            },
          },
          update: { name: chapterSeed.name, order: chapterSeed.order, status: 'approved' },
          create: {
            subjectId: subject.id,
            name: chapterSeed.name,
            slug: chapterSeed.slug,
            order: chapterSeed.order,
            version: 1,
            status: 'approved',
          },
        });
        console.log(`  Chapter: ${chapter.name} (${chapter.id})`);

        for (const topicSeed of chapterSeed.topics) {
          const topic = await tx.topicDef.upsert({
            where: {
              chapterId_slug: {
                chapterId: chapter.id,
                slug: topicSeed.slug,
              },
            },
            update: { name: topicSeed.name, order: topicSeed.order, status: 'approved' },
            create: {
              chapterId: chapter.id,
              name: topicSeed.name,
              slug: topicSeed.slug,
              order: topicSeed.order,
              status: 'approved',
            },
          });
          console.log(`    Topic: ${topic.name} (${topic.id})`);

          await tx.topicNote.upsert({
            where: {
              topicId_language_version: {
                topicId: topic.id,
                language: 'en',
                version: 1,
              },
            },
            update: {
              title: topicSeed.name,
              contentJson: topicSeed.note,
              status: 'approved',
              source: 'seed-ai-data',
            },
            create: {
              topicId: topic.id,
              language: 'en',
              version: 1,
              title: topicSeed.name,
              contentJson: topicSeed.note,
              source: 'seed-ai-data',
              status: 'approved',
            },
          });
          console.log(`      Note: seeded (approved, en, v1)`);

          // 6. Upsert GeneratedTest + GeneratedQuestion for each difficulty
          const qBank = questionsForTopic(topicSeed.slug, topicSeed.name);

          for (const difficulty of ['easy', 'medium', 'hard']) {
            const test = await tx.generatedTest.upsert({
              where: {
                topicId_difficulty_language_version: {
                  topicId: topic.id,
                  difficulty,
                  language: 'en',
                  version: 1,
                },
              },
              update: {
                title: `${topicSeed.name} – ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Test`,
                status: 'approved',
              },
              create: {
                topicId: topic.id,
                title: `${topicSeed.name} – ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Test`,
                difficulty,
                language: 'en',
                version: 1,
                status: 'approved',
              },
            });

            // Delete old questions for idempotency, then bulk insert fresh
            await tx.generatedQuestion.deleteMany({ where: { testId: test.id } });

            if (qBank[difficulty] && qBank[difficulty].length > 0) {
              const payload = qBank[difficulty].map((q) => ({
                testId: test.id,
                type: q.type,
                question: q.question,
                options: q.options,
                answer: q.answer,
                explanation: q.explanation,
                marks: q.marks,
              }));
              // createMany for efficiency
              await tx.generatedQuestion.createMany({ data: payload });
            }
            console.log(`      Test [${difficulty}]: ${qBank[difficulty].length} questions seeded`);
          }
        }
      });
    }
    console.log('');
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
