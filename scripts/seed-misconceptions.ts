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
    chapterName: 'Graph',
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
    triggerPatterns: ['atoms disappear', 'extra atoms after reaction', 'don’t need to balance equation'],
    correction:
      'In a chemical reaction, atoms are rearranged but not created or destroyed. Equations must be balanced so that the number of each type of atom is the same on both sides.',
  },
  {
    id: 'msc_heat_and_temperature_same',
    boardSlug: 'cbse',
    grade: 10,
    subjectSlug: 'science',
    chapterName: 'Heat',
    name: 'Heat and temperature are the same',
    description: 'Student confuses heat with temperature and uses the terms interchangeably.',
    triggerPatterns: ['heat and temperature are same', 'more heat = higher temperature always', 'temperature is amount of heat'],
    correction:
      'Temperature measures how hot or cold something is (average kinetic energy of particles). Heat is the energy transferred due to temperature difference.',
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

