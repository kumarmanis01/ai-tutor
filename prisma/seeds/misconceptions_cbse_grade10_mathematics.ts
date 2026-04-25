import type { PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export const MISCONCEPTIONS_MATH_GRADE10 = [
  {
    id: 'CBSE-MATH10-MIS-001',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH01-C001',
    name: 'Area vs Perimeter Confusion',
    description: 'Students confuse area and perimeter and apply linear formulas to area problems.',
    triggerPatterns: ['uses perimeter formula', 'adds side lengths instead of multiplying'],
    correction:
      'Explain units and show examples where doubling side length quadruples area but doubles perimeter.',
  },
  {
    id: 'CBSE-MATH10-MIS-002',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH01-C002',
    name: 'Order of Operations Errors',
    description: 'Ignoring operator precedence, evaluating left-to-right incorrectly.',
    triggerPatterns: ['evaluates 2+3*4 as (2+3)*4', 'missing parentheses handling'],
    correction: 'Reinforce PEMDAS/BODMAS with worked examples and ask intermediate-step checks.',
  },
  {
    id: 'CBSE-MATH10-MIS-003',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH02-C005',
    name: 'Negative Sign Distribution',
    description: 'Students drop or mis-distribute negative signs when expanding.',
    triggerPatterns: ['drops negative when expanding', 'sign flips incorrectly after distribution'],
    correction: 'Use color-coded terms or parentheses to track signs; show inverse-checks.',
  },
  {
    id: 'CBSE-MATH10-MIS-004',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH02-C006',
    name: 'Fraction Addition Mistakes',
    description: 'Adding numerators/denominators directly instead of using common denominators.',
    triggerPatterns: ['adds numerators and denominators directly', 'uses LCM incorrectly'],
    correction: 'Demonstrate common-denominator method and visual fraction models.',
  },
  {
    id: 'CBSE-MATH10-MIS-005',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH03-C010',
    name: 'Misreading Graph Axes',
    description: 'Interpreting axes scales incorrectly (e.g., swapping x and y).',
    triggerPatterns: ['reads x as y', 'uses wrong scale'],
    correction: 'Always label axes aloud and check units; practice with varied scales.',
  },
  {
    id: 'CBSE-MATH10-MIS-006',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH04-C002',
    name: 'Linear Equation Isolation Errors',
    description: 'Incorrectly isolate variables by performing operations on one side only.',
    triggerPatterns: ['adds/subtracts on one side only', 'forgets to apply inverse to both sides'],
    correction: 'Emphasize equality balance and show step-checking strategy.',
  },
  {
    id: 'CBSE-MATH10-MIS-007',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH04-C003',
    name: 'Mistaking Slope For Y-Intercept',
    description: 'Students read slope value as y-intercept when interpreting slope-intercept form.',
    triggerPatterns: ['reports slope as intercept', "reads 'm' as 'c'"],
    correction: 'Label m and c on examples and convert forms to check values.',
  },
  {
    id: 'CBSE-MATH10-MIS-008',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH05-C001',
    name: 'Circle Theorems Misapplication',
    description: 'Apply wrong theorem to angle/chord problems or mix complementary rules.',
    triggerPatterns: ['uses wrong circle theorem', 'assumes perpendicular implies bisector'],
    correction: 'Map each theorem to a visual cue and contrast with counterexamples.',
  },
  {
    id: 'CBSE-MATH10-MIS-009',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH05-C004',
    name: 'Area Formula Misuse',
    description: 'Using formula for rectangle/circle interchangeably or wrong units.',
    triggerPatterns: ['applies πr instead of πr²', 'uses base*height for circle'],
    correction: 'Anchor formula to shape visuals and check units/dimensions.',
  },
  {
    id: 'CBSE-MATH10-MIS-010',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH06-C002',
    name: 'Probability Complement Confusion',
    description: 'Forgetting complement rule P(A)=1-P(not A) or mixing independent event rules.',
    triggerPatterns: ['adds probabilities incorrectly', 'forgets complement'],
    correction: 'Use Venn-diagram examples and compute complements explicitly.',
  },
  {
    id: 'CBSE-MATH10-MIS-011',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH06-C003',
    name: 'Counting Without Order Awareness',
    description: 'Confuse permutations vs combinations; treat order as irrelevant incorrectly.',
    triggerPatterns: ['uses nCr when order matters', 'treats arrangements as combinations'],
    correction: 'Clarify example differences and use small n examples to show outcomes.',
  },
  {
    id: 'CBSE-MATH10-MIS-012',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH07-C001',
    name: 'Trigonometric Ratio Mis-Assignment',
    description: 'Mix up sine/cosine/tangent definitions in right-angled triangles.',
    triggerPatterns: ['uses sin where cos required', 'flips adjacent/opposite'],
    correction: 'Use mnemonic and unit-circle visual; ask student to label sides first.',
  },
  {
    id: 'CBSE-MATH10-MIS-013',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH07-C004',
    name: 'Radians vs Degrees',
    description:
      'Confuse units when applying trig functions, forgetting radian-mode in calculators.',
    triggerPatterns: ['uses degrees in radian formula', 'calculator mode error'],
    correction: 'Explicitly state and convert units; include calculator mode reminder.',
  },
  {
    id: 'CBSE-MATH10-MIS-014',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH08-C002',
    name: 'Algebraic Factorisation Mistakes',
    description: 'Dropping terms or mis-factorising quadratic expressions.',
    triggerPatterns: ['drops middle term', 'incorrect factor pair choices'],
    correction: 'Practice reverse-expansion checks and factor by grouping method.',
  },
  {
    id: 'CBSE-MATH10-MIS-015',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH08-C005',
    name: 'Equation Root Verification Skipped',
    description: 'Students accept algebraic roots without substituting back to verify.',
    triggerPatterns: ['never verify by substitution', 'assumes extraneous roots are valid'],
    correction: 'Require a final verification step in worked solutions.',
  },
  {
    id: 'CBSE-MATH10-MIS-016',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH09-C001',
    name: 'Mean vs Median Confusion',
    description: 'Using mean instead of median for skewed distributions or vice versa.',
    triggerPatterns: ['uses mean for skewed data', 'computes median incorrectly'],
    correction: 'Show skewed-data examples and compute both statistics.',
  },
  {
    id: 'CBSE-MATH10-MIS-017',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH09-C003',
    name: 'Graph of Quadratic Mis-interpretation',
    description: 'Mistake vertex direction or axis of symmetry positions.',
    triggerPatterns: ['vertex sign wrong', 'axis mis-located'],
    correction: 'Plot points and compute vertex formula to confirm.',
  },
  {
    id: 'CBSE-MATH10-MIS-018',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH10-C002',
    name: 'Compound Interest Formula Misuse',
    description: 'Confuse n for compounding periods vs years or forget conversion.',
    triggerPatterns: ['mixes annual rate with monthly periods', 'uses simple interest formula'],
    correction: 'Write out period rate and periods explicitly; unit-check each term.',
  },
  {
    id: 'CBSE-MATH10-MIS-019',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH10-C004',
    name: 'Logarithm Rule Errors',
    description: 'Apply log product/sum rules incorrectly or drop base information.',
    triggerPatterns: ['log(a+b) treated as log a + log b', 'drops base conversion'],
    correction: 'Reinforce algebraic derivations and check using exponentiation.',
  },
  {
    id: 'CBSE-MATH10-MIS-020',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH11-C001',
    name: 'Vector Direction vs Magnitude Errors',
    description: 'Confusing direction components with magnitude; sign errors in component algebra.',
    triggerPatterns: ['adds magnitudes directly', 'swaps components signs'],
    correction:
      'Separate magnitude calculation and component algebra; visual component decomposition.',
  },
];

export async function seedMisconceptions(prisma: PrismaClient, opts?: { dryRun?: boolean }) {
  for (const m of MISCONCEPTIONS_MATH_GRADE10) {
    if (opts?.dryRun) continue;
    await prisma.misconception.upsert({
      where: { id: m.id },
      update: {
        name: m.name,
        description: m.description,
        triggerPatterns: m.triggerPatterns,
        correction: m.correction,
        subjectId: m.subjectId,
        conceptId: m.conceptId,
        prevalenceRate: 0,
      },
      create: {
        id: m.id,
        name: m.name,
        description: m.description,
        triggerPatterns: m.triggerPatterns,
        correction: m.correction,
        subjectId: m.subjectId,
        conceptId: m.conceptId,
        prevalenceRate: 0,
      },
    });
  }
}

if (require.main === module) {
  (async () => {
    try {
      await seedMisconceptions(prisma);
      console.log('Seeded math misconceptions');
    } catch (err) {
      console.error('Seed failed', err);
      process.exit(1);
    } finally {
      try {
        await prisma.$disconnect();
      } catch {}
    }
  })();
}
