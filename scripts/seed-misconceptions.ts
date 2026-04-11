#!/usr/bin/env ts-node
/* eslint-disable no-console */

import { prisma } from '@/lib/prisma'

type SeedMisconception = {
  id: string
  boardSlug: string
  grade: number
  subjectSlug: 'math' | 'science'
  chapterName: string
  name: string
  description: string
  triggerPatterns: string[]
  correction: string
}

const SEEDS: SeedMisconception[] = [
  {
    id: 'msc_quadratic_negative_root',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'math',
    chapterName: 'Quadratic',
    name: 'Quadratic equation has only one root',
    description: 'Student believes that if x² = 9 then x = 3 only, ignoring the negative root.',
    triggerPatterns: ['x^2 = 9 so x = 3', 'square root of 9 is 3', 'only one solution for x^2'],
    correction:
      'For equations like x² = 9, there are two solutions: x = 3 and x = -3. The square root operation has a positive and a negative solution.',
  },
  {
    id: 'msc_binomial_square_missing_2ab',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'math',
    chapterName: 'Polynomials',
    name: 'Binomial square without middle term',
    description: 'Student expands (a + b)² as a² + b², missing the 2ab term.',
    triggerPatterns: ['(a+b)^2 = a^2 + b^2', 'ignores 2ab term', 'no middle term in (a+b)^2'],
    correction:
      'The correct expansion is (a + b)² = a² + 2ab + b². The 2ab term comes from multiplying a with b in both orders.',
  },
  {
    id: 'msc_trig_non_right_triangle',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'math',
    chapterName: 'Trigonometry',
    name: 'Right-triangle ratios on any triangle',
    description: 'Student applies sin and cos ratios directly to non-right triangles.',
    triggerPatterns: ['sin = opposite/hypotenuse for any triangle', 'use tan in any triangle', 'right angle not required'],
    correction:
      'The basic sine, cosine, and tangent ratios are defined for right-angled triangles only. For general triangles, you must use the sine rule or cosine rule.',
  },
  {
    id: 'msc_linear_vs_quadratic_graph',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'math',
    chapterName: 'Quadratic',
    name: 'Quadratic graphs are straight lines',
    description: 'Student thinks the graph of y = ax² + bx + c is a straight line.',
    triggerPatterns: ['parabola is a straight line', 'y = x^2 is linear', 'quadratic graph is a line'],
    correction:
      'Linear equations (y = mx + c) produce straight-line graphs. Quadratic equations (y = ax² + bx + c) produce curved graphs called parabolas.',
  },
  {
    id: 'msc_physical_vs_chemical_change',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'science',
    chapterName: 'Chemical Reactions',
    name: 'Melting as chemical change',
    description: 'Student believes that melting ice is a chemical change.',
    triggerPatterns: ['melting ice is a chemical change', 'change of state is chemical', 'melting changes substance'],
    correction:
      'Melting ice is a physical change because only the state changes from solid to liquid. The substance (water, H₂O) remains the same.',
  },
  {
    id: 'msc_all_acids_burn',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'science',
    chapterName: 'Acids, Bases and Salts',
    name: 'All acids burn skin',
    description: 'Student thinks every acid will burn the skin strongly.',
    triggerPatterns: ['all acids burn', 'any acid is dangerous', 'every acid is corrosive'],
    correction:
      'Strong acids can be corrosive, but not all acids are equally dangerous. For example, weak acids like acetic acid in vinegar are safe in small amounts.',
  },
  {
    id: 'msc_current_used_up',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'science',
    chapterName: 'Electricity',
    name: 'Current is used up in a circuit',
    description: 'Student believes that current is used up as it flows through devices.',
    triggerPatterns: ['current gets used up', 'less current after bulb', 'current is consumed'],
    correction:
      'Electric current is the flow of charge. Charge is conserved in a circuit. Devices use electrical energy, not the current itself.',
  },
  {
    id: 'msc_series_bulb_brightness',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'science',
    chapterName: 'Electricity',
    name: 'More bulbs in series are always brighter',
    description: 'Student thinks adding more bulbs in series makes each bulb brighter.',
    triggerPatterns: ['add bulbs to make it brighter in series', 'more bulbs = more brightness in same circuit'],
    correction:
      'In a series circuit, adding more bulbs increases total resistance and usually makes each bulb dimmer, not brighter.',
  },
  {
    id: 'msc_atoms_disappear_in_reaction',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'science',
    chapterName: 'Chemical Reactions',
    name: 'Atoms disappear or appear in reactions',
    description: 'Student thinks atoms can vanish or appear in a chemical equation without balancing.',
    triggerPatterns: ['atoms disappear', 'extra atoms after reaction', 'don't need to balance equation'],
    correction:
      'In a chemical reaction, atoms are rearranged but not created or destroyed. Equations must be balanced so that the number of each type of atom is the same on both sides.',
  },
  {
    id: 'msc_heat_and_temperature_same',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'science',
    chapterName: 'Chemical Reactions',
    name: 'Heat and temperature are the same',
    description: 'Student confuses heat with temperature and uses the terms interchangeably.',
    triggerPatterns: ['heat and temperature are same', 'more heat = higher temperature always', 'temperature is amount of heat'],
    correction:
      'Temperature measures how hot or cold something is (average kinetic energy of particles). Heat is the energy transferred due to temperature difference.',
  },

  // --- Math additions (brings Math total to 20) ---

  {
    id: 'msc_hcf_is_bigger_than_lcm',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'math',
    chapterName: 'Real Numbers',
    name: 'HCF can be larger than LCM',
    description: 'Student believes HCF of two numbers can be greater than their LCM.',
    triggerPatterns: ['hcf is bigger than lcm', 'hcf greater than lcm', 'hcf can be more than lcm'],
    correction:
      'HCF is always less than or equal to LCM. The LCM is the smallest common multiple, so it is always at least as large as any common factor.',
  },
  {
    id: 'msc_irrational_plus_rational_rational',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'math',
    chapterName: 'Real Numbers',
    name: 'Irrational + rational is always rational',
    description: 'Student believes adding any rational number to an irrational number gives a rational result.',
    triggerPatterns: ['irrational plus rational is rational', 'sqrt(2) + 1 is rational', 'adding rational makes it rational'],
    correction:
      'The sum of a rational and an irrational number is always irrational. For example, 1 + sqrt(2) cannot be expressed as p/q, so it remains irrational.',
  },
  {
    id: 'msc_zero_polynomial_degree',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'math',
    chapterName: 'Polynomials',
    name: 'Zero polynomial has degree zero',
    description: 'Student assigns degree 0 to the zero polynomial, confusing it with a non-zero constant.',
    triggerPatterns: ['zero polynomial has degree 0', 'degree of 0 polynomial is 0', 'zero polynomial is constant'],
    correction:
      'The zero polynomial (all coefficients are 0) is not assigned any degree. Only non-zero constant polynomials have degree 0.',
  },
  {
    id: 'msc_linear_equation_one_solution',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'math',
    chapterName: 'Pair of Linear Equations',
    name: 'Every pair of linear equations has exactly one solution',
    description: 'Student assumes any two linear equations always intersect at exactly one point.',
    triggerPatterns: ['two linear equations always have one solution', 'parallel lines still meet', 'linear system always has unique solution'],
    correction:
      'A pair of linear equations can have: one solution (lines intersect), no solution (parallel lines), or infinitely many solutions (coincident lines). The relationship between coefficients determines which case applies.',
  },
  {
    id: 'msc_ap_common_difference_positive',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'math',
    chapterName: 'Arithmetic Progressions',
    name: 'Common difference must be positive',
    description: 'Student believes an arithmetic progression must always increase.',
    triggerPatterns: ['common difference is always positive', 'AP always increases', 'decreasing sequence is not AP'],
    correction:
      'The common difference d can be positive (increasing AP), negative (decreasing AP), or zero (constant AP). All three are valid arithmetic progressions.',
  },
  {
    id: 'msc_similar_triangles_equal_area',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'math',
    chapterName: 'Triangles',
    name: 'Similar triangles have equal areas',
    description: 'Student conflates similarity (same shape) with congruence (same shape and size).',
    triggerPatterns: ['similar triangles have same area', 'same shape means same area', 'similar means congruent'],
    correction:
      'Similar triangles have the same shape but not necessarily the same size. Their areas are in the ratio of the square of corresponding sides, not equal unless they are also congruent.',
  },
  {
    id: 'msc_distance_formula_sign',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'math',
    chapterName: 'Coordinate Geometry',
    name: 'Distance can be negative',
    description: 'Student applies the distance formula and accepts a negative result without squaring.',
    triggerPatterns: ['distance is negative', 'distance formula gives negative', 'can have negative distance'],
    correction:
      'Distance is always non-negative. The formula sqrt((x2-x1)^2 + (y2-y1)^2) squares the differences first, so the result under the root is always >= 0 and distance is always >= 0.',
  },
  {
    id: 'msc_tan_90_defined',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'math',
    chapterName: 'Trigonometry',
    name: 'tan 90 degrees is defined',
    description: 'Student states tan(90) = 0 or some large number without recognising it is undefined.',
    triggerPatterns: ['tan 90 equals 0', 'tan 90 is defined', 'tan of 90 degrees has a value'],
    correction:
      'tan(90) = sin(90)/cos(90) = 1/0, which is undefined. At 90 degrees the cosine is zero, so division is not possible. The tangent function has no value at 90 degrees.',
  },
  {
    id: 'msc_circle_area_is_2pir',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'math',
    chapterName: 'Areas Related to Circles',
    name: 'Area of circle is 2 pi r',
    description: 'Student confuses circumference (2 pi r) with area (pi r squared).',
    triggerPatterns: ['area of circle is 2 pi r', 'area = 2pir', 'circle area is 2 times pi times r'],
    correction:
      'The circumference (perimeter) of a circle is 2 * pi * r. The area of a circle is pi * r^2. These are different formulas -- area uses r squared.',
  },
  {
    id: 'msc_volume_surface_area_same',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'math',
    chapterName: 'Surface Areas and Volumes',
    name: 'Volume and surface area are interchangeable',
    description: 'Student uses volume formula when surface area is asked, or vice versa.',
    triggerPatterns: ['volume and surface area are same', 'surface area equals volume', 'use volume formula for surface area'],
    correction:
      'Surface area measures the total area of outer faces (in square units). Volume measures the space inside (in cubic units). They require different formulas and represent different physical quantities.',
  },
  {
    id: 'msc_mean_equals_median',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'math',
    chapterName: 'Statistics',
    name: 'Mean and median are always equal',
    description: 'Student assumes the mean and median give the same value for any data set.',
    triggerPatterns: ['mean equals median', 'average and median are same', 'mean is always the middle value'],
    correction:
      'Mean is the arithmetic average (sum divided by count). Median is the middle value when data is sorted. They are equal only for symmetric distributions; for skewed data they differ.',
  },
  {
    id: 'msc_probability_greater_than_one',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'math',
    chapterName: 'Probability',
    name: 'Probability can be greater than 1',
    description: 'Student computes a ratio greater than 1 and accepts it as a valid probability.',
    triggerPatterns: ['probability can be more than 1', 'probability greater than 1 is possible', 'probability 1.5'],
    correction:
      'Probability is always between 0 and 1 inclusive. A value greater than 1 means a calculation error. Review whether you divided by the total number of outcomes correctly.',
  },
  {
    id: 'msc_quadratic_discriminant_negative_root',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'math',
    chapterName: 'Quadratic',
    name: 'Negative discriminant means one real root',
    description: 'Student believes a negative discriminant gives one real root instead of no real roots.',
    triggerPatterns: ['negative discriminant gives one root', 'D < 0 means one real solution', 'negative b squared minus 4ac gives a root'],
    correction:
      'When the discriminant (b^2 - 4ac) < 0, there are no real roots -- the equation has two complex (imaginary) roots. Two equal real roots occur only when the discriminant equals zero.',
  },
  {
    id: 'msc_perpendicular_bisector_angle_bisector',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'math',
    chapterName: 'Triangles',
    name: 'Perpendicular bisector and angle bisector are the same',
    description: 'Student confuses the perpendicular bisector of a side with the angle bisector from the opposite vertex.',
    triggerPatterns: ['perpendicular bisector is angle bisector', 'angle bisector bisects the opposite side perpendicularly', 'perpendicular bisector passes through vertex'],
    correction:
      'A perpendicular bisector passes through the midpoint of a side at 90 degrees -- it need not pass through the opposite vertex. An angle bisector divides a vertex angle into two equal parts and reaches the opposite side, but generally not at its midpoint.',
  },
  {
    id: 'msc_ap_nth_term_is_sum',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'math',
    chapterName: 'Arithmetic Progressions',
    name: 'nth term formula gives the sum of n terms',
    description: 'Student uses a_n = a + (n-1)d when the question asks for sum S_n.',
    triggerPatterns: ['nth term is the sum', 'use an formula for sum', 'a plus n minus 1 d is total sum'],
    correction:
      'a_n = a + (n-1)*d gives the VALUE of the nth term. To find the SUM of n terms use S_n = n/2 * (2a + (n-1)*d). These are different formulas for different questions.',
  },
  {
    id: 'msc_tangent_chord_same_line',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'math',
    chapterName: 'Areas Related to Circles',
    name: 'Tangent and chord are the same',
    description: 'Student confuses a tangent (touches circle at one point) with a chord (joins two points on the circle).',
    triggerPatterns: ['tangent is a chord', 'tangent joins two points on circle', 'chord touches at one point'],
    correction:
      'A chord connects two points ON the circle. A tangent touches the circle at exactly one point and does not enter the circle. The tangent is perpendicular to the radius at the point of contact.',
  },

  // --- Science additions (brings Science total to 20) ---

  {
    id: 'msc_oxidation_is_adding_oxygen_only',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'science',
    chapterName: 'Chemical Reactions',
    name: 'Oxidation only means adding oxygen',
    description: 'Student thinks oxidation exclusively means combining with oxygen, ignoring electron loss.',
    triggerPatterns: ['oxidation only means adding oxygen', 'oxidation is only gaining oxygen', 'oxidation does not involve electrons'],
    correction:
      'Oxidation means loss of electrons (or gain of oxygen, or loss of hydrogen). The electron-transfer definition is broader: a substance is oxidised when it loses electrons, even without oxygen present.',
  },
  {
    id: 'msc_noble_gases_form_no_compounds',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'science',
    chapterName: 'Periodic Classification',
    name: 'Noble gases form absolutely no compounds',
    description: 'Student states noble gases never react under any circumstances.',
    triggerPatterns: ['noble gases never react', 'inert gases form no compounds ever', 'helium neon argon never bond'],
    correction:
      'Noble gases are generally very unreactive due to complete outer shells. However, heavier noble gases like xenon and krypton can form compounds (e.g., XeF2) under specific laboratory conditions. At CBSE level, they are treated as inert for practical purposes.',
  },
  {
    id: 'msc_plants_only_photosynthesise',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'science',
    chapterName: 'Life Processes',
    name: 'Plants only do photosynthesis, not respiration',
    description: 'Student believes plants only photosynthesise and do not respire like animals.',
    triggerPatterns: ['plants do not respire', 'only animals do respiration', 'plants only photosynthesise'],
    correction:
      'Plants carry out BOTH photosynthesis (in light, in chloroplasts) AND cellular respiration (all the time, in mitochondria). During daylight, photosynthesis rate exceeds respiration rate, so net oxygen is released.',
  },
  {
    id: 'msc_veins_carry_deoxygenated_blood',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'science',
    chapterName: 'Life Processes',
    name: 'Veins always carry deoxygenated blood',
    description: 'Student thinks all veins carry deoxygenated blood without exception.',
    triggerPatterns: ['all veins carry deoxygenated blood', 'veins never carry oxygenated blood', 'only arteries have oxygenated blood'],
    correction:
      'Most veins carry deoxygenated blood back to the heart, but the pulmonary veins are the exception -- they carry oxygenated blood from the lungs to the heart. The rule is about direction (toward heart) not oxygen content.',
  },
  {
    id: 'msc_nervous_endocrine_same',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'science',
    chapterName: 'Control and Coordination',
    name: 'Nervous and endocrine systems are the same',
    description: 'Student treats the nervous system and hormonal (endocrine) system as a single control mechanism.',
    triggerPatterns: ['nervous system and hormones are same', 'hormones travel through nerves', 'nervous and endocrine system are the same'],
    correction:
      'The nervous system uses electrical impulses through neurons for fast, short-term control. The endocrine system uses hormones released into the bloodstream for slower, longer-lasting control. They are separate but complementary systems.',
  },
  {
    id: 'msc_dna_same_in_all_cells',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'science',
    chapterName: 'Heredity and Evolution',
    name: 'Different cells in a body have different DNA',
    description: 'Student believes muscle cells have different DNA from nerve cells because they look and behave differently.',
    triggerPatterns: ['muscle cells have different dna', 'each cell type has its own dna', 'cells have different genes based on function'],
    correction:
      'All cells in a person\'s body (except mature red blood cells and gametes) contain the same DNA. Cells differ because different genes are expressed (switched on or off), not because the DNA sequence differs.',
  },
  {
    id: 'msc_light_travels_faster_in_glass',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'science',
    chapterName: 'Light-Reflection and Refraction',
    name: 'Light travels faster in glass than in air',
    description: 'Student confuses the direction of refraction with the speed of light in a denser medium.',
    triggerPatterns: ['light is faster in glass', 'glass speeds up light', 'light travels faster in denser medium'],
    correction:
      'Light travels slower in denser media (like glass or water) than in air or vacuum. That slowing is why refraction occurs -- the wavefront bends when crossing from one medium to another.',
  },
  {
    id: 'msc_convex_lens_always_magnifies',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'science',
    chapterName: 'Light-Reflection and Refraction',
    name: 'Convex lens always magnifies',
    description: 'Student thinks a convex lens always produces a magnified image regardless of object position.',
    triggerPatterns: ['convex lens always magnifies', 'convex always gives bigger image', 'converging lens always enlarges'],
    correction:
      'A convex lens only magnifies when the object is inside the focal length (producing a virtual, erect, magnified image). When the object is beyond the focal length, the image is real and can be smaller, same size, or larger depending on object distance.',
  },
  {
    id: 'msc_resistance_increases_current',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'science',
    chapterName: 'Electricity',
    name: 'Adding resistance increases current',
    description: 'Student believes a higher resistance means more current flows because "more work is being done".',
    triggerPatterns: ['more resistance means more current', 'higher resistance gives higher current', 'resistance causes more current to flow'],
    correction:
      'By Ohm\'s law (I = V/R), for a fixed voltage, increasing resistance DECREASES current. Resistance opposes the flow of charge -- a higher resistance means fewer charges can flow per second.',
  },
  {
    id: 'msc_magnet_pole_removal',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'science',
    chapterName: 'Magnetic Effects of Electric Current',
    name: 'You can separate north and south poles of a magnet',
    description: 'Student believes cutting a magnet in half will give a separate north pole and a separate south pole.',
    triggerPatterns: ['cut magnet to separate poles', 'north and south pole can be separated', 'half magnet has only one pole'],
    correction:
      'Magnetic poles always come in pairs. When you cut a bar magnet, each piece forms a new complete magnet with its own north and south pole. Isolated magnetic monopoles have not been found.',
  },
  {
    id: 'msc_renewable_inexhaustible',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'science',
    chapterName: 'Sources of Energy',
    name: 'Renewable energy sources are always environmentally harmless',
    description: 'Student assumes renewable = zero environmental impact.',
    triggerPatterns: ['solar energy has no environmental impact', 'wind power causes no pollution ever', 'renewable energy is completely clean'],
    correction:
      'Renewable energy sources replenish naturally and produce far less pollution than fossil fuels, but they are not impact-free. For example, large hydropower dams flood ecosystems, and manufacturing solar panels involves energy use and materials. Renewable means replenishable, not impact-free.',
  },
  {
    id: 'msc_food_chain_energy_fully_transferred',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'science',
    chapterName: 'Management of Natural Resources',
    name: 'All energy is transferred up the food chain',
    description: 'Student believes 100% of energy at one trophic level passes to the next.',
    triggerPatterns: ['all energy is transferred in food chain', '100 percent energy passes to next level', 'no energy is lost between trophic levels'],
    correction:
      'Only about 10% of energy from one trophic level is available to the next (the 10% rule). The remaining 90% is lost as heat, used for the organism\'s own metabolic processes, or locked in waste. This is why food chains rarely exceed 4-5 levels.',
  },
  {
    id: 'msc_metals_always_solid',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'science',
    chapterName: 'Metals and Non-metals',
    name: 'All metals are solid at room temperature',
    description: 'Student states that every metal is a solid under normal conditions.',
    triggerPatterns: ['all metals are solid', 'metals are always solid', 'no liquid metals at room temperature'],
    correction:
      'Mercury (Hg) is a metal that is liquid at room temperature. Gallium (Ga) melts just above room temperature. Most metals are solid at room temperature, but there are exceptions -- state this carefully.',
  },
  {
    id: 'msc_carbon_only_in_living_things',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'science',
    chapterName: 'Carbon Compounds',
    name: 'Carbon compounds only exist in living things',
    description: 'Student believes organic (carbon-based) compounds are found exclusively in biological organisms.',
    triggerPatterns: ['carbon compounds only in living things', 'organic means only from living organisms', 'carbon compounds cannot be made in lab'],
    correction:
      'Carbon compounds are not limited to living organisms. They can be synthesised in the laboratory (e.g., urea was first synthesised from inorganic material by Wohler in 1828). Carbon compounds include fuels like methane and plastics like polyethylene, which are not living.',
  },
]

async function main() {
  let createdOrUpdated = 0

  for (const seed of SEEDS) {
    try {
      const chapter = await prisma.chapterDef.findFirst({
        where: {
          name: { contains: seed.chapterName, mode: 'insensitive' },
          lifecycle: 'active',
          subject: {
            slug: seed.subjectSlug,
            lifecycle: 'active',
            class: {
              grade: seed.grade,
              lifecycle: 'active',
              board: {
                slug: { equals: seed.boardSlug, mode: 'insensitive' },
                lifecycle: 'active',
              },
            },
          },
        },
        select: { id: true, subjectId: true, name: true },
      })

      if (!chapter) {
        console.warn(
          `[seed-misconceptions] Chapter not found for board=${seed.boardSlug}, grade=${seed.grade}, subject=${seed.subjectSlug}, chapterName="${seed.chapterName}"; skipping ${seed.id}`,
        )
        continue
      }

      const concept = await prisma.concept.findFirst({
        where: {
          topic: {
            chapterId: chapter.id,
          },
        },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      })

      if (!concept) {
        console.warn(
          `[seed-misconceptions] Concept not found for chapterId=${chapter.id} (chapterName="${chapter.name}"); skipping ${seed.id}`,
        )
        continue
      }

      await prisma.misconception.upsert({
        where: { id: seed.id },
        create: {
          id: seed.id,
          subjectId: chapter.subjectId,
          conceptId: concept.id,
          name: seed.name,
          description: seed.description,
          triggerPatterns: seed.triggerPatterns,
          correction: seed.correction,
        },
        update: {
          subjectId: chapter.subjectId,
          conceptId: concept.id,
          name: seed.name,
          description: seed.description,
          triggerPatterns: seed.triggerPatterns,
          correction: seed.correction,
        },
      })

      createdOrUpdated += 1
    } catch (err) {
      console.error(`[seed-misconceptions] Failed to upsert ${seed.id}`, err)
    }
  }

  console.log(`[seed-misconceptions] Completed. Misconceptions upserted: ${createdOrUpdated}/${SEEDS.length}`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })

