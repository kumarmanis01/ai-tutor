/**
 * FILE OBJECTIVE:
 * - Idempotent seed script for the `TopicConcept` table.
 *   Populates CBSE/ICSE concepts for grades 6-10 across Maths, Science,
 *   English, and Social Science. Safe to rerun -- uses createMany with skipDuplicates.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | initial seed for demand-pull generate flow (task S3)
 */

import { prisma } from '../../lib/prisma';

interface ConceptRow {
  title: string;
  summary: string;
  orderIndex: number;
}

interface ConceptSeedRow {
  topicSlug: string;
  subject: string;
  grade: string;
  board: string;
  concepts: ConceptRow[];
}

// ─── CBSE Grade 6 ─────────────────────────────────────────────────────────────

const CBSE_G6_MATHS: ConceptSeedRow[] = [
  {
    topicSlug: 'knowing-our-numbers',
    subject: 'mathematics',
    grade: '6',
    board: 'CBSE',
    concepts: [
      { title: 'Large Numbers', summary: 'Understanding and reading large numbers up to crores and beyond using the Indian place value system.', orderIndex: 1 },
      { title: 'Estimation', summary: 'Approximating numbers by rounding to the nearest 10, 100, or 1000 to simplify calculations.', orderIndex: 2 },
      { title: 'Roman Numerals', summary: 'Reading and writing Roman numerals using symbols I, V, X, L, C, D, M and their combination rules.', orderIndex: 3 },
    ],
  },
  {
    topicSlug: 'whole-numbers',
    subject: 'mathematics',
    grade: '6',
    board: 'CBSE',
    concepts: [
      { title: 'Number Line', summary: 'Representing whole numbers on a number line and understanding their order and relationships.', orderIndex: 1 },
      { title: 'Properties of Whole Numbers', summary: 'Closure, commutativity, associativity, and distributivity properties of addition and multiplication of whole numbers.', orderIndex: 2 },
      { title: 'Patterns in Whole Numbers', summary: 'Identifying arithmetic patterns such as triangular numbers, square numbers, and number sequences.', orderIndex: 3 },
    ],
  },
  {
    topicSlug: 'playing-with-numbers',
    subject: 'mathematics',
    grade: '6',
    board: 'CBSE',
    concepts: [
      { title: 'Factors and Multiples', summary: 'Understanding factors as numbers that divide exactly and multiples as products of a number.', orderIndex: 1 },
      { title: 'Prime and Composite Numbers', summary: 'Distinguishing prime numbers (exactly two factors) from composite numbers (more than two factors).', orderIndex: 2 },
      { title: 'HCF and LCM', summary: 'Finding the Highest Common Factor and Lowest Common Multiple using prime factorisation and division methods.', orderIndex: 3 },
      { title: 'Tests of Divisibility', summary: 'Divisibility rules for 2, 3, 4, 5, 6, 8, 9, 10, and 11 to quickly check divisibility without division.', orderIndex: 4 },
    ],
  },
  {
    topicSlug: 'basic-geometrical-ideas',
    subject: 'mathematics',
    grade: '6',
    board: 'CBSE',
    concepts: [
      { title: 'Points, Lines, and Angles', summary: 'Defining geometric fundamentals: points have no dimensions, lines extend infinitely, and angles form when two rays meet at a point.', orderIndex: 1 },
      { title: 'Polygons and Curves', summary: 'Classifying shapes as open or closed curves, and understanding properties of polygons like triangles, quadrilaterals, and pentagons.', orderIndex: 2 },
    ],
  },
  {
    topicSlug: 'fractions',
    subject: 'mathematics',
    grade: '6',
    board: 'CBSE',
    concepts: [
      { title: 'Types of Fractions', summary: 'Classifying fractions as proper, improper, and mixed numbers, and converting between them.', orderIndex: 1 },
      { title: 'Equivalent Fractions', summary: 'Finding fractions equal in value by multiplying or dividing numerator and denominator by the same number.', orderIndex: 2 },
      { title: 'Comparing Fractions', summary: 'Ordering fractions using cross-multiplication or common denominator methods.', orderIndex: 3 },
      { title: 'Operations on Fractions', summary: 'Adding, subtracting, multiplying, and dividing fractions using standard algorithms.', orderIndex: 4 },
    ],
  },
];

const CBSE_G6_SCIENCE: ConceptSeedRow[] = [
  {
    topicSlug: 'food-where-does-it-come-from',
    subject: 'science',
    grade: '6',
    board: 'CBSE',
    concepts: [
      { title: 'Plant Sources of Food', summary: 'Identifying parts of plants (roots, stems, leaves, flowers, fruits, seeds) that are eaten as food by humans and animals.', orderIndex: 1 },
      { title: 'Animal Sources of Food', summary: 'Understanding dairy products, eggs, meat, and honey as animal-derived food sources and their nutritional role.', orderIndex: 2 },
      { title: 'Herbivores, Carnivores, Omnivores', summary: 'Classifying animals by diet: herbivores eat only plants, carnivores eat only animals, and omnivores eat both.', orderIndex: 3 },
    ],
  },
  {
    topicSlug: 'components-of-food',
    subject: 'science',
    grade: '6',
    board: 'CBSE',
    concepts: [
      { title: 'Nutrients and Their Functions', summary: 'The six major nutrients (carbohydrates, proteins, fats, vitamins, minerals, water) and their roles in body growth and maintenance.', orderIndex: 1 },
      { title: 'Balanced Diet', summary: 'A diet that provides all nutrients in correct proportions to maintain health, growth, and energy throughout the day.', orderIndex: 2 },
      { title: 'Deficiency Diseases', summary: 'Diseases caused by lack of specific nutrients, such as scurvy (vitamin C), rickets (vitamin D), and anaemia (iron).', orderIndex: 3 },
    ],
  },
  {
    topicSlug: 'fibre-to-fabric',
    subject: 'science',
    grade: '6',
    board: 'CBSE',
    concepts: [
      { title: 'Plant Fibres', summary: 'Cotton and jute are natural plant fibres; cotton comes from the cotton boll and jute from the jute plant stem.', orderIndex: 1 },
      { title: 'Animal Fibres', summary: 'Wool (from sheep fleece) and silk (from silkworm cocoons) are animal-derived fibres used to make fabric.', orderIndex: 2 },
      { title: 'Weaving and Knitting', summary: 'Fabric is made by weaving (interlacing two sets of threads at right angles) or knitting (looping a single thread).', orderIndex: 3 },
    ],
  },
  {
    topicSlug: 'sorting-materials-into-groups',
    subject: 'science',
    grade: '6',
    board: 'CBSE',
    concepts: [
      { title: 'Properties of Materials', summary: 'Materials are classified by properties such as hardness, solubility, transparency, conductivity, and magnetic behaviour.', orderIndex: 1 },
      { title: 'Soluble and Insoluble Substances', summary: 'Soluble substances dissolve in water (like salt, sugar) while insoluble substances do not (like chalk, sand).', orderIndex: 2 },
    ],
  },
  {
    topicSlug: 'living-organisms-and-surroundings',
    subject: 'science',
    grade: '6',
    board: 'CBSE',
    concepts: [
      { title: 'Habitat and Adaptation', summary: 'A habitat is the natural environment where an organism lives; adaptations are features that help it survive in that habitat.', orderIndex: 1 },
      { title: 'Biotic and Abiotic Components', summary: 'Biotic components are living things (plants, animals, microbes) while abiotic components are non-living (soil, water, air, sunlight).', orderIndex: 2 },
    ],
  },
];

// ─── CBSE Grade 7 ─────────────────────────────────────────────────────────────

const CBSE_G7_MATHS: ConceptSeedRow[] = [
  {
    topicSlug: 'integers',
    subject: 'mathematics',
    grade: '7',
    board: 'CBSE',
    concepts: [
      { title: 'Operations on Integers', summary: 'Adding, subtracting, multiplying, and dividing positive and negative integers using rules of signs.', orderIndex: 1 },
      { title: 'Properties of Integers', summary: 'Closure, commutativity, associativity, and distributivity of integers under various operations.', orderIndex: 2 },
    ],
  },
  {
    topicSlug: 'fractions-and-decimals',
    subject: 'mathematics',
    grade: '7',
    board: 'CBSE',
    concepts: [
      { title: 'Multiplication of Fractions', summary: 'Multiplying fractions by fractions, whole numbers, and mixed numbers using the standard algorithm.', orderIndex: 1 },
      { title: 'Division of Fractions', summary: 'Dividing fractions by multiplying by the reciprocal of the divisor.', orderIndex: 2 },
      { title: 'Decimal Operations', summary: 'Performing multiplication and division of decimals, including by powers of 10.', orderIndex: 3 },
    ],
  },
  {
    topicSlug: 'simple-equations',
    subject: 'mathematics',
    grade: '7',
    board: 'CBSE',
    concepts: [
      { title: 'Setting Up Equations', summary: 'Translating word problems into algebraic equations using variables to represent unknown quantities.', orderIndex: 1 },
      { title: 'Solving One-Step Equations', summary: 'Using balancing method or transposition to solve linear equations with one variable.', orderIndex: 2 },
      { title: 'Applications of Equations', summary: 'Applying linear equations to solve real-world problems involving age, money, and geometry.', orderIndex: 3 },
    ],
  },
  {
    topicSlug: 'lines-and-angles',
    subject: 'mathematics',
    grade: '7',
    board: 'CBSE',
    concepts: [
      { title: 'Pairs of Angles', summary: 'Complementary (sum 90 degrees), supplementary (sum 180 degrees), adjacent, and vertically opposite angle pairs.', orderIndex: 1 },
      { title: 'Parallel Lines and Transversal', summary: 'When a transversal crosses parallel lines, alternate interior angles are equal, corresponding angles are equal, and co-interior angles are supplementary.', orderIndex: 2 },
    ],
  },
  {
    topicSlug: 'ratio-and-proportion',
    subject: 'mathematics',
    grade: '7',
    board: 'CBSE',
    concepts: [
      { title: 'Ratio', summary: 'A ratio compares two quantities of the same kind; it is written as a:b and can be simplified like a fraction.', orderIndex: 1 },
      { title: 'Proportion', summary: 'Four quantities are in proportion if the ratio of the first two equals the ratio of the last two; solved using cross-multiplication.', orderIndex: 2 },
      { title: 'Unitary Method', summary: 'Finding the value of one unit first, then scaling to find the value of any number of units.', orderIndex: 3 },
    ],
  },
];

const CBSE_G7_SCIENCE: ConceptSeedRow[] = [
  {
    topicSlug: 'nutrition-in-plants',
    subject: 'science',
    grade: '7',
    board: 'CBSE',
    concepts: [
      { title: 'Photosynthesis', summary: 'Green plants make their own food using sunlight, water, and carbon dioxide; chlorophyll absorbs light energy to drive this process.', orderIndex: 1 },
      { title: 'Modes of Nutrition', summary: 'Autotrophs make their own food; heterotrophs depend on other organisms; some plants are parasitic or insectivorous.', orderIndex: 2 },
      { title: 'Saprotrophic Nutrition', summary: 'Organisms like fungi and bacteria break down dead organic matter to obtain nutrients, returning minerals to the soil.', orderIndex: 3 },
    ],
  },
  {
    topicSlug: 'heat',
    subject: 'science',
    grade: '7',
    board: 'CBSE',
    concepts: [
      { title: 'Temperature and Thermometers', summary: 'Temperature measures the degree of hotness; clinical and laboratory thermometers use mercury or alcohol to measure it accurately.', orderIndex: 1 },
      { title: 'Conduction, Convection, Radiation', summary: 'Heat transfers through conduction (solids), convection (fluids), and radiation (without a medium) from hotter to cooler objects.', orderIndex: 2 },
      { title: 'Conductors and Insulators', summary: 'Conductors (metals) allow heat to pass easily; insulators (wood, plastic) resist heat flow, used in everyday applications.', orderIndex: 3 },
    ],
  },
  {
    topicSlug: 'acids-bases-and-salts',
    subject: 'science',
    grade: '7',
    board: 'CBSE',
    concepts: [
      { title: 'Acids and Their Properties', summary: 'Acids taste sour, turn blue litmus red, and release hydrogen ions in water; common examples are citric acid and hydrochloric acid.', orderIndex: 1 },
      { title: 'Bases and Their Properties', summary: 'Bases taste bitter, feel soapy, turn red litmus blue, and release hydroxide ions in water; common examples are baking soda and lime.', orderIndex: 2 },
      { title: 'Neutralisation', summary: 'When an acid and a base react, they neutralise each other to form a salt and water; pH 7 indicates a neutral solution.', orderIndex: 3 },
    ],
  },
];

// ─── CBSE Grade 8 ─────────────────────────────────────────────────────────────

const CBSE_G8_MATHS: ConceptSeedRow[] = [
  {
    topicSlug: 'rational-numbers',
    subject: 'mathematics',
    grade: '8',
    board: 'CBSE',
    concepts: [
      { title: 'Properties of Rational Numbers', summary: 'Closure, commutativity, associativity, and distributivity of rational numbers under addition, subtraction, multiplication, and division.', orderIndex: 1 },
      { title: 'Representation on Number Line', summary: 'Plotting rational numbers on a number line and finding rational numbers between two given rationals.', orderIndex: 2 },
    ],
  },
  {
    topicSlug: 'linear-equations-in-one-variable',
    subject: 'mathematics',
    grade: '8',
    board: 'CBSE',
    concepts: [
      { title: 'Solving Linear Equations', summary: 'Using transposition and balancing to solve linear equations with variables on both sides of the equality sign.', orderIndex: 1 },
      { title: 'Equations Reducible to Linear Form', summary: 'Clearing fractions and brackets to convert complex-looking equations into standard linear form before solving.', orderIndex: 2 },
      { title: 'Word Problems', summary: 'Formulating and solving linear equations for real-life situations involving ages, numbers, and geometric shapes.', orderIndex: 3 },
    ],
  },
  {
    topicSlug: 'understanding-quadrilaterals',
    subject: 'mathematics',
    grade: '8',
    board: 'CBSE',
    concepts: [
      { title: 'Polygons and Their Properties', summary: 'Sum of interior angles of a polygon with n sides is (n-2) x 180 degrees; sum of exterior angles is always 360 degrees.', orderIndex: 1 },
      { title: 'Types of Quadrilaterals', summary: 'Parallelogram, rectangle, rhombus, square, trapezium, and kite -- their properties involving sides, angles, and diagonals.', orderIndex: 2 },
    ],
  },
  {
    topicSlug: 'algebraic-expressions-and-identities',
    subject: 'mathematics',
    grade: '8',
    board: 'CBSE',
    concepts: [
      { title: 'Multiplication of Polynomials', summary: 'Multiplying a monomial by a polynomial and multiplying two binomials using the distributive law.', orderIndex: 1 },
      { title: 'Standard Identities', summary: 'Four key identities: (a+b)^2, (a-b)^2, (a+b)(a-b), and (x+a)(x+b) used to expand and factorise expressions quickly.', orderIndex: 2 },
    ],
  },
  {
    topicSlug: 'exponents-and-powers',
    subject: 'mathematics',
    grade: '8',
    board: 'CBSE',
    concepts: [
      { title: 'Laws of Exponents', summary: 'Rules for multiplying and dividing powers with the same base, raising a power to a power, and negative exponents.', orderIndex: 1 },
      { title: 'Standard Form', summary: 'Writing very large or very small numbers in scientific notation as a x 10^n where 1 <= a < 10.', orderIndex: 2 },
    ],
  },
];

const CBSE_G8_SCIENCE: ConceptSeedRow[] = [
  {
    topicSlug: 'crop-production-and-management',
    subject: 'science',
    grade: '8',
    board: 'CBSE',
    concepts: [
      { title: 'Agricultural Practices', summary: 'The sequence of activities in farming: soil preparation, sowing, irrigation, weeding, harvesting, and storage.', orderIndex: 1 },
      { title: 'Manure and Fertilisers', summary: 'Manure is natural organic matter that improves soil texture; fertilisers are chemical compounds that supply specific nutrients quickly.', orderIndex: 2 },
      { title: 'Irrigation Methods', summary: 'Traditional methods (moat, chain pump) and modern methods (sprinkler, drip irrigation) for delivering water to crops efficiently.', orderIndex: 3 },
    ],
  },
  {
    topicSlug: 'microorganisms',
    subject: 'science',
    grade: '8',
    board: 'CBSE',
    concepts: [
      { title: 'Types of Microorganisms', summary: 'Bacteria, fungi, algae, protozoa, and viruses -- their sizes, habitats, and basic structural differences.', orderIndex: 1 },
      { title: 'Useful Microorganisms', summary: 'Microorganisms are used in making curd, bread, and wine; in nitrogen fixation; and in producing antibiotics like penicillin.', orderIndex: 2 },
      { title: 'Harmful Microorganisms', summary: 'Disease-causing pathogens, food spoilage bacteria, and agents of plant diseases; methods of preservation and prevention.', orderIndex: 3 },
    ],
  },
  {
    topicSlug: 'combustion-and-flame',
    subject: 'science',
    grade: '8',
    board: 'CBSE',
    concepts: [
      { title: 'Types of Combustion', summary: 'Rapid combustion (produces heat and light quickly), spontaneous combustion (no external heat source needed), and explosion.', orderIndex: 1 },
      { title: 'Flame Structure', summary: 'A candle flame has three zones: innermost dark zone (unburnt vapours), middle luminous zone (incomplete combustion), outer blue zone (complete combustion).', orderIndex: 2 },
      { title: 'Fuels and Calorific Value', summary: 'Calorific value is the heat energy released per unit mass of fuel; higher calorific value means more efficient fuel.', orderIndex: 3 },
    ],
  },
];

// ─── CBSE Grade 9 ─────────────────────────────────────────────────────────────

const CBSE_G9_MATHS: ConceptSeedRow[] = [
  {
    topicSlug: 'number-systems',
    subject: 'mathematics',
    grade: '9',
    board: 'CBSE',
    concepts: [
      { title: 'Irrational Numbers', summary: 'Numbers that cannot be expressed as a fraction p/q; their decimal expansions are non-terminating and non-repeating.', orderIndex: 1 },
      { title: 'Real Numbers and Number Line', summary: 'The real number line contains all rational and irrational numbers; representing surds on the number line using geometric construction.', orderIndex: 2 },
      { title: 'Laws of Exponents for Real Numbers', summary: 'Extending the laws of indices to rational exponents: a^(m/n) = (a^m)^(1/n) and related properties.', orderIndex: 3 },
    ],
  },
  {
    topicSlug: 'polynomials',
    subject: 'mathematics',
    grade: '9',
    board: 'CBSE',
    concepts: [
      { title: 'Zeroes of a Polynomial', summary: 'A zero of a polynomial p(x) is a value c where p(c) = 0; a polynomial of degree n can have at most n zeroes.', orderIndex: 1 },
      { title: 'Remainder and Factor Theorems', summary: 'Remainder theorem: dividing p(x) by (x-a) gives remainder p(a). Factor theorem: (x-a) is a factor if and only if p(a) = 0.', orderIndex: 2 },
      { title: 'Factorisation of Polynomials', summary: 'Splitting a polynomial into the product of two or more polynomials using factor theorem, identities, and grouping.', orderIndex: 3 },
    ],
  },
  {
    topicSlug: 'coordinate-geometry',
    subject: 'mathematics',
    grade: '9',
    board: 'CBSE',
    concepts: [
      { title: 'Cartesian Plane', summary: 'The coordinate plane formed by two perpendicular number lines (x-axis and y-axis); points located using ordered pairs (x, y).', orderIndex: 1 },
      { title: 'Plotting Points', summary: 'Locating points in all four quadrants and on the axes by counting units along horizontal and vertical directions from the origin.', orderIndex: 2 },
    ],
  },
  {
    topicSlug: 'triangles',
    subject: 'mathematics',
    grade: '9',
    board: 'CBSE',
    concepts: [
      { title: 'Congruence Criteria', summary: 'Two triangles are congruent if corresponding sides and angles match; the criteria are SAS, ASA, AAS, SSS, and RHS.', orderIndex: 1 },
      { title: 'Properties of Triangles', summary: 'Angles opposite equal sides are equal; the triangle inequality theorem; exterior angle theorem.', orderIndex: 2 },
    ],
  },
  {
    topicSlug: 'linear-equations-in-two-variables',
    subject: 'mathematics',
    grade: '9',
    board: 'CBSE',
    concepts: [
      { title: 'Solutions of Linear Equations', summary: 'A linear equation ax + by + c = 0 has infinitely many solutions; each solution is an ordered pair (x, y) on the graph line.', orderIndex: 1 },
      { title: 'Graph of a Linear Equation', summary: 'The graph of any linear equation in two variables is a straight line; graphing using two or three solution points.', orderIndex: 2 },
    ],
  },
];

const CBSE_G9_SCIENCE: ConceptSeedRow[] = [
  {
    topicSlug: 'matter-in-our-surroundings',
    subject: 'science',
    grade: '9',
    board: 'CBSE',
    concepts: [
      { title: 'States of Matter', summary: 'Matter exists as solid, liquid, or gas; these states differ in particle arrangement, intermolecular forces, and kinetic energy.', orderIndex: 1 },
      { title: 'Change of State', summary: 'Fusion, vaporisation, sublimation and their reverses; latent heat is absorbed or released without temperature change during phase transitions.', orderIndex: 2 },
      { title: 'Diffusion and Brownian Motion', summary: 'Diffusion is the intermixing of particles due to random motion; Brownian motion is the random zigzag movement of particles in a fluid.', orderIndex: 3 },
    ],
  },
  {
    topicSlug: 'is-matter-around-us-pure',
    subject: 'science',
    grade: '9',
    board: 'CBSE',
    concepts: [
      { title: 'Mixtures and Solutions', summary: 'A mixture has components mixed without chemical bonding; a solution is a homogeneous mixture with a solute dissolved in a solvent.', orderIndex: 1 },
      { title: 'Separation Techniques', summary: 'Evaporation, distillation, fractional distillation, chromatography, and centrifugation for separating different kinds of mixtures.', orderIndex: 2 },
      { title: 'Compounds vs Mixtures', summary: 'In a compound, elements combine in a fixed ratio by chemical bonds; in a mixture, components retain their properties and vary in proportion.', orderIndex: 3 },
    ],
  },
  {
    topicSlug: 'motion',
    subject: 'science',
    grade: '9',
    board: 'CBSE',
    concepts: [
      { title: 'Distance and Displacement', summary: 'Distance is the total path length (scalar); displacement is the straight-line change in position with direction (vector).', orderIndex: 1 },
      { title: 'Speed and Velocity', summary: 'Speed = distance/time (scalar); velocity = displacement/time (vector); average velocity is total displacement divided by total time.', orderIndex: 2 },
      { title: 'Equations of Motion', summary: 'Three kinematic equations (v = u + at; s = ut + 0.5at^2; v^2 = u^2 + 2as) link initial velocity, final velocity, acceleration, and displacement.', orderIndex: 3 },
      { title: 'Uniform Circular Motion', summary: 'An object moving in a circle at constant speed still has acceleration because its direction changes; this centripetal acceleration points toward the centre.', orderIndex: 4 },
    ],
  },
  {
    topicSlug: 'force-and-laws-of-motion',
    subject: 'science',
    grade: '9',
    board: 'CBSE',
    concepts: [
      { title: "Newton's First Law", summary: 'An object remains at rest or in uniform motion unless acted upon by an unbalanced external force; this tendency is called inertia.', orderIndex: 1 },
      { title: "Newton's Second Law", summary: 'Force equals mass times acceleration (F = ma); a net force causes a change in the momentum of the object in the direction of the force.', orderIndex: 2 },
      { title: "Newton's Third Law", summary: 'For every action there is an equal and opposite reaction; the two forces act on different objects and can never cancel each other.', orderIndex: 3 },
    ],
  },
];

// ─── CBSE Grade 10 ────────────────────────────────────────────────────────────

const CBSE_G10_MATHS: ConceptSeedRow[] = [
  {
    topicSlug: 'real-numbers',
    subject: 'mathematics',
    grade: '10',
    board: 'CBSE',
    concepts: [
      { title: "Euclid's Division Lemma", summary: "For any two positive integers a and b, there exist unique integers q and r such that a = bq + r where 0 <= r < b.", orderIndex: 1 },
      { title: 'Fundamental Theorem of Arithmetic', summary: 'Every integer greater than 1 can be expressed uniquely as a product of prime numbers (up to order).', orderIndex: 2 },
      { title: 'Irrational Numbers Revisited', summary: 'Proving irrationality of numbers like sqrt(2), sqrt(3), and sqrt(5) using the method of contradiction.', orderIndex: 3 },
    ],
  },
  {
    topicSlug: 'polynomials',
    subject: 'mathematics',
    grade: '10',
    board: 'CBSE',
    concepts: [
      { title: 'Zeroes and Coefficients', summary: 'For a quadratic ax^2 + bx + c, the sum of zeroes = -b/a and the product of zeroes = c/a.', orderIndex: 1 },
      { title: 'Division Algorithm', summary: 'For polynomials p(x) and g(x), p(x) = g(x) q(x) + r(x) where degree of r(x) < degree of g(x).', orderIndex: 2 },
    ],
  },
  {
    topicSlug: 'quadratic-equations',
    subject: 'mathematics',
    grade: '10',
    board: 'CBSE',
    concepts: [
      { title: 'Solving by Factorisation', summary: 'Expressing a quadratic as a product of two linear factors and setting each factor to zero to find the roots.', orderIndex: 1 },
      { title: 'Quadratic Formula', summary: 'The roots of ax^2 + bx + c = 0 are given by x = (-b +/- sqrt(b^2 - 4ac)) / 2a; the discriminant determines nature of roots.', orderIndex: 2 },
      { title: 'Nature of Roots', summary: 'If discriminant > 0: two distinct real roots; = 0: two equal real roots; < 0: no real roots.', orderIndex: 3 },
    ],
  },
  {
    topicSlug: 'arithmetic-progressions',
    subject: 'mathematics',
    grade: '10',
    board: 'CBSE',
    concepts: [
      { title: 'nth Term of an AP', summary: 'The nth term of an AP with first term a and common difference d is: a_n = a + (n-1)d.', orderIndex: 1 },
      { title: 'Sum of n Terms', summary: 'Sum of first n terms of an AP: S_n = n/2 * (2a + (n-1)d) = n/2 * (a + l) where l is the last term.', orderIndex: 2 },
    ],
  },
  {
    topicSlug: 'triangles',
    subject: 'mathematics',
    grade: '10',
    board: 'CBSE',
    concepts: [
      { title: 'Similar Triangles', summary: 'Two triangles are similar if their corresponding angles are equal and corresponding sides are proportional; criteria: AA, SAS, SSS.', orderIndex: 1 },
      { title: 'Basic Proportionality Theorem', summary: 'If a line is drawn parallel to one side of a triangle, it divides the other two sides in the same ratio (Thales theorem).', orderIndex: 2 },
      { title: 'Pythagoras Theorem', summary: 'In a right triangle, the square of the hypotenuse equals the sum of squares of the other two sides: c^2 = a^2 + b^2.', orderIndex: 3 },
    ],
  },
];

const CBSE_G10_SCIENCE: ConceptSeedRow[] = [
  {
    topicSlug: 'chemical-reactions-and-equations',
    subject: 'science',
    grade: '10',
    board: 'CBSE',
    concepts: [
      { title: 'Types of Chemical Reactions', summary: 'Combination, decomposition, displacement, double displacement, and oxidation-reduction reactions with examples and balancing.', orderIndex: 1 },
      { title: 'Balancing Chemical Equations', summary: 'Applying the law of conservation of mass to balance equations; the number of atoms of each element must be equal on both sides.', orderIndex: 2 },
      { title: 'Oxidation and Reduction', summary: 'Oxidation is loss of electrons or gain of oxygen; reduction is gain of electrons or loss of oxygen; redox reactions involve both.', orderIndex: 3 },
    ],
  },
  {
    topicSlug: 'acids-bases-and-salts',
    subject: 'science',
    grade: '10',
    board: 'CBSE',
    concepts: [
      { title: 'Arrhenius Theory', summary: 'Acids produce H+ ions in water; bases produce OH- ions in water; neutralisation forms salt and water.', orderIndex: 1 },
      { title: 'pH Scale', summary: 'pH measures hydrogen ion concentration on a scale 0-14; pH < 7 is acidic, pH = 7 is neutral, pH > 7 is basic.', orderIndex: 2 },
      { title: 'Important Salts', summary: 'Common salt (NaCl), washing soda (Na2CO3), baking soda (NaHCO3), bleaching powder, and plaster of Paris -- their preparation and uses.', orderIndex: 3 },
    ],
  },
  {
    topicSlug: 'life-processes',
    subject: 'science',
    grade: '10',
    board: 'CBSE',
    concepts: [
      { title: 'Nutrition', summary: 'Autotrophic nutrition (photosynthesis in plants) and heterotrophic nutrition (holozoic, parasitic, saprophytic in animals).', orderIndex: 1 },
      { title: 'Respiration', summary: 'Aerobic respiration (with oxygen) produces more ATP than anaerobic; cellular respiration breaks down glucose in mitochondria.', orderIndex: 2 },
      { title: 'Transportation', summary: 'In humans: blood transports O2, nutrients, hormones; heart pumps blood; in plants: xylem carries water, phloem carries food.', orderIndex: 3 },
      { title: 'Excretion', summary: 'Kidneys filter blood to form urine; nephron is the functional unit; dialysis machines replace kidney function when they fail.', orderIndex: 4 },
    ],
  },
  {
    topicSlug: 'electricity',
    subject: 'science',
    grade: '10',
    board: 'CBSE',
    concepts: [
      { title: "Ohm's Law", summary: "At constant temperature, the current through a conductor is directly proportional to the potential difference: V = IR.", orderIndex: 1 },
      { title: 'Series and Parallel Circuits', summary: 'In series: same current, resistances add. In parallel: same voltage, reciprocals of resistance add. Parallel circuits are used in homes.', orderIndex: 2 },
      { title: 'Heating Effect of Current', summary: "Joule's law: heat produced H = I^2 * R * t; applied in electric irons, heaters, and fuses.", orderIndex: 3 },
      { title: 'Electric Power', summary: 'Power P = VI = I^2 R = V^2/R measured in watts; 1 kWh (unit) = 3.6 x 10^6 J is used for billing electricity.', orderIndex: 4 },
    ],
  },
];

// ─── CBSE Social Science Grade 6-10 ──────────────────────────────────────────

const CBSE_SS_ROWS: ConceptSeedRow[] = [
  {
    topicSlug: 'the-earth-in-the-solar-system',
    subject: 'social-science',
    grade: '6',
    board: 'CBSE',
    concepts: [
      { title: 'Solar System', summary: 'The solar system comprises the Sun and eight planets (plus dwarf planets) held in orbit by gravitational attraction.', orderIndex: 1 },
      { title: 'Earth as a Unique Planet', summary: 'Earth is the only known planet with liquid water, breathable atmosphere, and the right temperature range to support life.', orderIndex: 2 },
    ],
  },
  {
    topicSlug: 'globe-latitudes-and-longitudes',
    subject: 'social-science',
    grade: '6',
    board: 'CBSE',
    concepts: [
      { title: 'Latitudes', summary: 'Imaginary horizontal lines parallel to the equator measuring angular distance north or south; the equator is 0 degrees latitude.', orderIndex: 1 },
      { title: 'Longitudes and Time Zones', summary: 'Imaginary vertical lines from pole to pole; the Prime Meridian (0 degrees) passes through Greenwich; every 15 degrees equals one hour.', orderIndex: 2 },
    ],
  },
  {
    topicSlug: 'physical-features-of-india',
    subject: 'social-science',
    grade: '9',
    board: 'CBSE',
    concepts: [
      { title: 'Himalayan Mountains', summary: 'The youngest fold mountains running from west to east; three parallel ranges (Greater, Lesser, Outer Himalayas) formed by tectonic collision.', orderIndex: 1 },
      { title: 'Northern Plains', summary: 'Vast flat plains formed by alluvial deposits of rivers Indus, Ganga, and Brahmaputra; highly fertile and densely populated.', orderIndex: 2 },
      { title: 'Peninsular Plateau', summary: 'The oldest landmass of India, composed of hard igneous and metamorphic rocks; includes the Deccan Plateau, Western Ghats, and Eastern Ghats.', orderIndex: 3 },
    ],
  },
  {
    topicSlug: 'democracy-and-constitution',
    subject: 'social-science',
    grade: '9',
    board: 'CBSE',
    concepts: [
      { title: 'Constitutional Design', summary: 'Constitutions define the fundamental rules of governance; India adopted its constitution on 26 January 1950 after extensive deliberation.', orderIndex: 1 },
      { title: 'Fundamental Rights', summary: 'Six fundamental rights in Part III of the Indian Constitution including equality, freedom, against exploitation, religion, culture, and constitutional remedies.', orderIndex: 2 },
    ],
  },
  {
    topicSlug: 'development',
    subject: 'social-science',
    grade: '10',
    board: 'CBSE',
    concepts: [
      { title: 'Development Goals', summary: 'Different people and groups have different development goals; national development considers average income, human development indicators, and sustainability.', orderIndex: 1 },
      { title: 'HDI and Per Capita Income', summary: 'Human Development Index measures health, education, and income; per capita income alone is insufficient to measure quality of life.', orderIndex: 2 },
    ],
  },
];

// ─── CBSE English Grade 8-10 ─────────────────────────────────────────────────

const CBSE_ENGLISH_ROWS: ConceptSeedRow[] = [
  {
    topicSlug: 'reading-comprehension',
    subject: 'english',
    grade: '8',
    board: 'CBSE',
    concepts: [
      { title: 'Unseen Passage -- Factual', summary: 'Strategies for reading factual passages: identifying main idea, finding specific information, and inferring meaning from context.', orderIndex: 1 },
      { title: 'Unseen Passage -- Discursive', summary: 'Techniques for discursive passages: understanding the argument, recognising the author\'s viewpoint, and answering analytical questions.', orderIndex: 2 },
    ],
  },
  {
    topicSlug: 'writing-skills',
    subject: 'english',
    grade: '9',
    board: 'CBSE',
    concepts: [
      { title: 'Formal Letter Writing', summary: 'Structure and conventions of formal letters: sender address, date, recipient address, subject line, body paragraphs, and closing.', orderIndex: 1 },
      { title: 'Story Writing', summary: 'Developing a story from a prompt: creating characters, setting, conflict, rising action, climax, and resolution.', orderIndex: 2 },
      { title: 'Descriptive Writing', summary: 'Using sensory details, vivid adjectives, and well-organised paragraphs to describe a person, place, or experience vividly.', orderIndex: 3 },
    ],
  },
  {
    topicSlug: 'grammar',
    subject: 'english',
    grade: '10',
    board: 'CBSE',
    concepts: [
      { title: 'Tenses', summary: 'The 12 tense forms in English covering present, past, and future in simple, continuous, perfect, and perfect-continuous aspects.', orderIndex: 1 },
      { title: 'Voice -- Active and Passive', summary: 'Converting sentences between active voice (subject performs action) and passive voice (subject receives action) across all tenses.', orderIndex: 2 },
      { title: 'Reported Speech', summary: 'Transforming direct speech to indirect speech: changing pronouns, tense backshift, and time/place references.', orderIndex: 3 },
      { title: 'Modals', summary: 'Using can, could, may, might, must, shall, should, will, would correctly to express ability, permission, probability, and obligation.', orderIndex: 4 },
    ],
  },
];

// ─── All rows combined ─────────────────────────────────────────────────────────

const ALL_ROWS: ConceptSeedRow[] = [
  ...CBSE_G6_MATHS,
  ...CBSE_G6_SCIENCE,
  ...CBSE_G7_MATHS,
  ...CBSE_G7_SCIENCE,
  ...CBSE_G8_MATHS,
  ...CBSE_G8_SCIENCE,
  ...CBSE_G9_MATHS,
  ...CBSE_G9_SCIENCE,
  ...CBSE_G10_MATHS,
  ...CBSE_G10_SCIENCE,
  ...CBSE_SS_ROWS,
  ...CBSE_ENGLISH_ROWS,
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  let totalInserted = 0;

  for (const row of ALL_ROWS) {
    const data = row.concepts.map((c) => ({
      topicSlug: row.topicSlug,
      subject: row.subject,
      grade: row.grade,
      board: row.board,
      title: c.title,
      summary: c.summary,
      orderIndex: c.orderIndex,
    }));

    const result = await prisma.topicConcept.createMany({ data, skipDuplicates: true });
    totalInserted += result.count;
  }

  console.log(`Seeded ${totalInserted} concepts across ${ALL_ROWS.length} topic groups.`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
