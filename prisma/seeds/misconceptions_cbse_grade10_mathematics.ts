import type { PrismaClient } from '@prisma/client'
import { prisma } from '../../lib/prisma'

export const MISCONCEPTIONS_MATH_GRADE10 = [
  {
    id: 'CBSE-MATH10-MIS-001',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH01-C001',
    name: 'Area vs Perimeter Confusion',
    description: 'Students confuse area and perimeter and apply linear formulas to area problems.',
    triggerPatterns: ['uses perimeter formula', 'adds side lengths instead of multiplying'],
    correction: 'Explain units and show examples where doubling side length quadruples area but doubles perimeter.',
    contrastiveExample: 'A 2x3 rectangle has perimeter 10 (2+3+2+3) but area 6 (2x3). A 4x3 rectangle has perimeter 14 but area 12 -- doubling one side doubles perimeter but doubles area too.',
  },
  {
    id: 'CBSE-MATH10-MIS-002',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH01-C002',
    name: 'Order of Operations Errors',
    description: 'Ignoring operator precedence, evaluating left-to-right incorrectly.',
    triggerPatterns: ['evaluates 2+3*4 as (2+3)*4', 'missing parentheses handling'],
    correction: 'Reinforce PEMDAS/BODMAS with worked examples and ask intermediate-step checks.',
    contrastiveExample: '2+3*4: wrong = (2+3)*4 = 20; correct = 2+(3*4) = 14. The multiplication binds tighter than addition.',
  },
  {
    id: 'CBSE-MATH10-MIS-003',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH02-C005',
    name: 'Negative Sign Distribution',
    description: 'Students drop or mis-distribute negative signs when expanding.',
    triggerPatterns: ['drops negative when expanding', 'sign flips incorrectly after distribution'],
    correction: 'Use color-coded terms or parentheses to track signs; show inverse-checks.',
    contrastiveExample: '-(a-b): wrong = -a-b; correct = -a+b. Every term inside flips sign. Verify: -(3-5) = -(-2) = 2, and -3+5 = 2.',
  },
  {
    id: 'CBSE-MATH10-MIS-004',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH02-C006',
    name: 'Fraction Addition Mistakes',
    description: 'Adding numerators/denominators directly instead of using common denominators.',
    triggerPatterns: ['adds numerators and denominators directly', 'uses LCM incorrectly'],
    correction: 'Demonstrate common-denominator method and visual fraction models.',
    contrastiveExample: '1/2 + 1/3: wrong = 2/5; correct = 3/6 + 2/6 = 5/6. Adding halves and thirds of the same pizza illustrates why 2/5 makes no sense.',
  },
  {
    id: 'CBSE-MATH10-MIS-005',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH03-C010',
    name: 'Misreading Graph Axes',
    description: 'Interpreting axes scales incorrectly (e.g., swapping x and y).',
    triggerPatterns: ['reads x as y', 'uses wrong scale'],
    correction: 'Always label axes aloud and check units; practice with varied scales.',
    contrastiveExample: 'Point (3, 7) means x=3 (horizontal) and y=7 (vertical). Reading it as x=7 gives a completely different location on the graph.',
  },
  {
    id: 'CBSE-MATH10-MIS-006',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH04-C002',
    name: 'Linear Equation Isolation Errors',
    description: 'Incorrectly isolate variables by performing operations on one side only.',
    triggerPatterns: ['adds/subtracts on one side only', 'forgets to apply inverse to both sides'],
    correction: 'Emphasize equality balance and show step-checking strategy.',
    contrastiveExample: 'x+5=12: wrong = x=12+5=17; correct = x=12-5=7. Think of a scale: subtracting 5 from one pan requires subtracting 5 from the other.',
  },
  {
    id: 'CBSE-MATH10-MIS-007',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH04-C003',
    name: 'Mistaking Slope For Y-Intercept',
    description: 'Students read slope value as y-intercept when interpreting slope-intercept form.',
    triggerPatterns: ['reports slope as intercept', "reads 'm' as 'c'"],
    correction: 'Label m and c on examples and convert forms to check values.',
    contrastiveExample: 'y=3x+7: m=3 (slope, how steep) and c=7 (y-intercept, where line crosses y-axis). Contrast with y=7x+3 where these values swap roles.',
  },
  {
    id: 'CBSE-MATH10-MIS-008',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH05-C001',
    name: 'Circle Theorems Misapplication',
    description: 'Apply wrong theorem to angle/chord problems or mix complementary rules.',
    triggerPatterns: ['uses wrong circle theorem', 'assumes perpendicular implies bisector'],
    correction: 'Map each theorem to a visual cue and contrast with counterexamples.',
    contrastiveExample: 'A perpendicular from the centre to a chord bisects it -- but a perpendicular from a non-centre point does NOT bisect the chord. Always check if the point is the centre.',
  },
  {
    id: 'CBSE-MATH10-MIS-009',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH05-C004',
    name: 'Area Formula Misuse',
    description: 'Using formula for rectangle/circle interchangeably or wrong units.',
    triggerPatterns: ['applies πr instead of πr²', 'uses base*height for circle'],
    correction: 'Anchor formula to shape visuals and check units/dimensions.',
    contrastiveExample: 'Circle radius 5: circumference = 2π5 = 31.4 cm (linear), area = π(5²) = 78.5 cm² (square). Wrong: area = π*5 = 15.7 -- this gives circumference, not area.',
  },
  {
    id: 'CBSE-MATH10-MIS-010',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH06-C002',
    name: 'Probability Complement Confusion',
    description: 'Forgetting complement rule P(A)=1-P(not A) or mixing independent event rules.',
    triggerPatterns: ['adds probabilities incorrectly', 'forgets complement'],
    correction: 'Use Venn-diagram examples and compute complements explicitly.',
    contrastiveExample: 'P(rain)=0.3, so P(no rain)=1-0.3=0.7. Wrong: P(no rain)=0.3 (same value). The two must sum to 1.',
  },
  {
    id: 'CBSE-MATH10-MIS-011',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH06-C003',
    name: 'Counting Without Order Awareness',
    description: 'Confuse permutations vs combinations; treat order as irrelevant incorrectly.',
    triggerPatterns: ['uses nCr when order matters', 'treats arrangements as combinations'],
    correction: 'Clarify example differences and use small n examples to show outcomes.',
    contrastiveExample: 'Choosing 2 from {A,B,C}: combinations = {AB,AC,BC} = 3C2 = 3. Permutations = {AB,BA,AC,CA,BC,CB} = 3P2 = 6. When a password order matters, use permutations.',
  },
  {
    id: 'CBSE-MATH10-MIS-012',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH07-C001',
    name: 'Trigonometric Ratio Mis-Assignment',
    description: 'Mix up sine/cosine/tangent definitions in right-angled triangles.',
    triggerPatterns: ['uses sin where cos required', 'flips adjacent/opposite'],
    correction: 'Use mnemonic and unit-circle visual; ask student to label sides first.',
    contrastiveExample: 'In a right triangle with angle 30 degrees, opposite=1, hypotenuse=2, adjacent=sqrt(3). sin(30)=1/2, cos(30)=sqrt(3)/2. Swapping gives wrong ratio.',
  },
  {
    id: 'CBSE-MATH10-MIS-013',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH07-C004',
    name: 'Radians vs Degrees',
    description: 'Confuse units when applying trig functions, forgetting radian-mode in calculators.',
    triggerPatterns: ['uses degrees in radian formula', 'calculator mode error'],
    correction: 'Explicitly state and convert units; include calculator mode reminder.',
    contrastiveExample: 'sin(90 degrees)=1 but sin(90 radians) approx 0.894 -- very different. Always check calculator mode before computing trig values.',
  },
  {
    id: 'CBSE-MATH10-MIS-014',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH08-C002',
    name: 'Algebraic Factorisation Mistakes',
    description: 'Dropping terms or mis-factorising quadratic expressions.',
    triggerPatterns: ['drops middle term', 'incorrect factor pair choices'],
    correction: 'Practice reverse-expansion checks and factor by grouping method.',
    contrastiveExample: 'x²+5x+6: wrong factors = (x+6)(x+1) -- expanding gives x²+7x+6; correct = (x+2)(x+3) -- check: 2*3=6, 2+3=5.',
  },
  {
    id: 'CBSE-MATH10-MIS-015',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH08-C005',
    name: 'Equation Root Verification Skipped',
    description: 'Students accept algebraic roots without substituting back to verify.',
    triggerPatterns: ['never verify by substitution', 'assumes extraneous roots are valid'],
    correction: 'Require a final verification step in worked solutions.',
    contrastiveExample: 'sqrt(x)=-3: squaring gives x=9, but substituting back: sqrt(9)=3 not -3. Without verification, the invalid root x=9 would be accepted.',
  },
  {
    id: 'CBSE-MATH10-MIS-016',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH09-C001',
    name: 'Mean vs Median Confusion',
    description: 'Using mean instead of median for skewed distributions or vice versa.',
    triggerPatterns: ['uses mean for skewed data', 'computes median incorrectly'],
    correction: 'Show skewed-data examples and compute both statistics.',
    contrastiveExample: 'Dataset {1,2,3,4,100}: mean=22, median=3. The outlier 100 drags the mean far above the typical value; median 3 better represents the centre.',
  },
  {
    id: 'CBSE-MATH10-MIS-017',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH09-C003',
    name: 'Graph of Quadratic Mis-interpretation',
    description: 'Mistake vertex direction or axis of symmetry positions.',
    triggerPatterns: ['vertex sign wrong', 'axis mis-located'],
    correction: 'Plot points and compute vertex formula to confirm.',
    contrastiveExample: 'y=(x-3)²+2 has vertex (3,2) opening upward. y=-(x-3)²+2 has the same vertex but opens downward -- the negative leading coefficient flips the parabola.',
  },
  {
    id: 'CBSE-MATH10-MIS-018',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH10-C002',
    name: 'Compound Interest Formula Misuse',
    description: 'Confuse n for compounding periods vs years or forget conversion.',
    triggerPatterns: ['mixes annual rate with monthly periods', 'uses simple interest formula'],
    correction: 'Write out period rate and periods explicitly; unit-check each term.',
    contrastiveExample: '12% annual compounded monthly: period rate = 12%/12 = 1%, n = years*12. Wrong: using 12% and n=years gives a different (lower) answer because compounding is less frequent.',
  },
  {
    id: 'CBSE-MATH10-MIS-019',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH10-C004',
    name: 'Logarithm Rule Errors',
    description: 'Apply log product/sum rules incorrectly or drop base information.',
    triggerPatterns: ['log(a+b) treated as log a + log b', 'drops base conversion'],
    correction: 'Reinforce algebraic derivations and check using exponentiation.',
    contrastiveExample: 'log(2+8)=log(10)=1 (base 10). But log(2)+log(8)=log(16) approx 1.2. Adding inside the log is NOT the same as adding two logs.',
  },
  {
    id: 'CBSE-MATH10-MIS-020',
    subjectId: 'CBSE-MATH-10',
    conceptId: 'CBSE-MATH10-CH11-C001',
    name: 'Vector Direction vs Magnitude Errors',
    description: 'Confusing direction components with magnitude; sign errors in component algebra.',
    triggerPatterns: ['adds magnitudes directly', 'swaps components signs'],
    correction: 'Separate magnitude calculation and component algebra; visual component decomposition.',
    contrastiveExample: 'Vectors (3,0) and (-3,0): magnitudes are both 3, but they point in opposite directions. Adding them gives (0,0), not (6,0) -- you cannot simply add magnitudes.',
  },
]

export async function seedMisconceptions(prisma: PrismaClient, opts?: { dryRun?: boolean }) {
  for (const m of MISCONCEPTIONS_MATH_GRADE10) {
    if (opts?.dryRun) continue
    await prisma.misconception.upsert({
      where: { id: m.id },
      update: {
        name: m.name,
        description: m.description,
        triggerPatterns: m.triggerPatterns,
        correction: m.correction,
        contrastiveExample: m.contrastiveExample,
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
        contrastiveExample: m.contrastiveExample,
        subjectId: m.subjectId,
        conceptId: m.conceptId,
        prevalenceRate: 0,
      },
    })
  }
}

if (require.main === module) {
  ;(async () => {
    try {
      await seedMisconceptions(prisma)
      console.log('Seeded math misconceptions')
    } catch (err) {
      console.error('Seed failed', err)
      process.exit(1)
    } finally {
      try { await prisma.$disconnect() } catch {}
    }
  })()
}
