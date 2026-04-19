import { PrismaClient } from '@prisma/client'

export const MISCONCEPTIONS_SCIENCE_GRADE10 = [
  {
    id: 'CBSE-SCI10-MIS-001',
    subjectId: 'CBSE-SCI-10',
    conceptId: 'CBSE-SCI10-CH01-C001',
    name: 'Forces vs Motion Mix-up',
    description: 'Confuse force direction and motion direction; think force always in direction of motion.',
    triggerPatterns: ['force always same direction as motion', 'ignores inertia'],
    correction: 'Explain Newton\'s first law with examples of balanced forces and inertia.',
  },
  {
    id: 'CBSE-SCI10-MIS-002',
    subjectId: 'CBSE-SCI-10',
    conceptId: 'CBSE-SCI10-CH01-C002',
    name: 'Mass vs Weight Confusion',
    description: 'Interchange mass and weight, forgetting weight depends on gravity.',
    triggerPatterns: ['uses kg for weight in N', 'treats mass variable with location'],
    correction: 'Distinguish mass (kg) vs weight (N) and show calculation weight=mg.',
  },
  {
    id: 'CBSE-SCI10-MIS-003',
    subjectId: 'CBSE-SCI-10',
    conceptId: 'CBSE-SCI10-CH02-C003',
    name: 'Heat vs Temperature',
    description: 'Confuse heat (energy transfer) with temperature (intensive property).',
    triggerPatterns: ['heat measured in °C', 'uses heat and temperature interchangeably'],
    correction: 'Use examples of different masses with same temp and calorimetry problems.',
  },
  {
    id: 'CBSE-SCI10-MIS-004',
    subjectId: 'CBSE-SCI-10',
    conceptId: 'CBSE-SCI10-CH02-C004',
    name: 'Conservation Mistakes',
    description: 'Assume energy/mass created or lost in closed system without accounting for forms.',
    triggerPatterns: ['adds energy arbitrarily', 'forgets chemical to heat conversion'],
    correction: 'Frame problems with energy flow diagrams and balance accounts.',
  },
  {
    id: 'CBSE-SCI10-MIS-005',
    subjectId: 'CBSE-SCI-10',
    conceptId: 'CBSE-SCI10-CH03-C001',
    name: 'Photosynthesis Inputs/Outputs',
    description: 'Reverse reactants/products (CO2 vs O2) or forget light as input.',
    triggerPatterns: ['lists O2 as reactant', 'omits light'],
    correction: 'Use balanced equation and relate to gaseous exchange experiments.',
  },
  {
    id: 'CBSE-SCI10-MIS-006',
    subjectId: 'CBSE-SCI-10',
    conceptId: 'CBSE-SCI10-CH03-C002',
    name: 'Respiration vs Breathing',
    description: 'Treat breathing and cellular respiration as identical processes.',
    triggerPatterns: ['says breathing produces ATP', 'uses respiration interchangeably with breathing'],
    correction: 'Clarify physiological scales and show cellular pathways (glycolysis overview).',
  },
  {
    id: 'CBSE-SCI10-MIS-007',
    subjectId: 'CBSE-SCI-10',
    conceptId: 'CBSE-SCI10-CH04-C004',
    name: 'Electric Current vs Voltage',
    description: 'Confuse current (flow) and voltage (potential), or think voltage is consumed.',
    triggerPatterns: ['says voltage used up', 'treats current and voltage as same'],
    correction: 'Use water-flow analogy carefully and emphasise conservation of charge.',
  },
  {
    id: 'CBSE-SCI10-MIS-008',
    subjectId: 'CBSE-SCI-10',
    conceptId: 'CBSE-SCI10-CH04-C005',
    name: 'Series vs Parallel Misunderstanding',
    description: 'Mix behaviours of series and parallel circuits regarding current and voltage.',
    triggerPatterns: ['thinks current same in parallel branches', 'voltage adds in parallel'],
    correction: 'Compare with experiments and compute using simple resistor examples.',
  },
  {
    id: 'CBSE-SCI10-MIS-009',
    subjectId: 'CBSE-SCI-10',
    conceptId: 'CBSE-SCI10-CH05-C002',
    name: 'Element vs Compound vs Mixture',
    description: 'Confuse definitions; call compounds elements or mixtures as compounds.',
    triggerPatterns: ['calls NaCl an element', 'labels mixture as compound'],
    correction: 'Use particle diagrams and separation technique examples.',
  },
  {
    id: 'CBSE-SCI10-MIS-010',
    subjectId: 'CBSE-SCI-10',
    conceptId: 'CBSE-SCI10-CH05-C006',
    name: 'Acid/Base Neutralisation Misconception',
    description: 'Assume neutralisation always produces water only or forget salt product.',
    triggerPatterns: ['says neutralisation only makes water', 'omits salt product'],
    correction: 'Show generic reaction: acid + base → salt + water, with examples.',
  },
  {
    id: 'CBSE-SCI10-MIS-011',
    subjectId: 'CBSE-SCI-10',
    conceptId: 'CBSE-SCI10-CH06-C001',
    name: 'Cell Structure Role Confusion',
    description: 'Mix up organelle functions (e.g., mitochondria vs chloroplast functions).',
    triggerPatterns: ['calls mitochondria site of photosynthesis', 'uses nucleus as ribosome site'],
    correction: 'Use labelled diagrams and functional mnemonics.',
  },
  {
    id: 'CBSE-SCI10-MIS-012',
    subjectId: 'CBSE-SCI-10',
    conceptId: 'CBSE-SCI10-CH06-C004',
    name: 'Genetics Simplification',
    description: 'Assume dominant allele always appears or think phenotype = genotype always.',
    triggerPatterns: ['dominant always expressed', 'confuses genotype and phenotype'],
    correction: 'Use Punnett square examples and probability outcomes.',
  },
  {
    id: 'CBSE-SCI10-MIS-013',
    subjectId: 'CBSE-SCI-10',
    conceptId: 'CBSE-SCI10-CH07-C002',
    name: 'Motion Graph Interpretation',
    description: 'Confuse slope/area interpretations on velocity/acceleration graphs.',
    triggerPatterns: ['treats area under v-t as velocity', 'reads slope as speed directly'],
    correction: 'Translate between position/velocity/acceleration with stepwise examples.',
  },
  {
    id: 'CBSE-SCI10-MIS-014',
    subjectId: 'CBSE-SCI-10',
    conceptId: 'CBSE-SCI10-CH08-C003',
    name: 'Sound vs Light Wave Misconceptions',
    description: 'Treat sound and light as the same wave type (mechanical vs electromagnetic).',
    triggerPatterns: ['says sound travels in vacuum', 'confuses transverse vs longitudinal'],
    correction: 'Contrast mediums and wave properties with experiments and examples.',
  },
  {
    id: 'CBSE-SCI10-MIS-015',
    subjectId: 'CBSE-SCI-10',
    conceptId: 'CBSE-SCI10-CH09-C001',
    name: 'Human Digestive Function Errors',
    description: 'Assign wrong functions to digestive organs (e.g., stomach absorbs nutrients).',
    triggerPatterns: ['says stomach absorbs nutrients', 'confuses digestion and absorption sites'],
    correction: 'Map organs to functions and absorption locations in the gut.',
  },
  {
    id: 'CBSE-SCI10-MIS-016',
    subjectId: 'CBSE-SCI-10',
    conceptId: 'CBSE-SCI10-CH09-C004',
    name: 'Enzyme Function Overgeneralisation',
    description: 'Think enzymes work for all substrates or change reaction equilibrium.',
    triggerPatterns: ['enzyme works for any substrate', 'enzyme changes equilibrium'],
    correction: 'Explain active site specificity and catalytic role without shifting equilibrium.',
  },
  {
    id: 'CBSE-SCI10-MIS-017',
    subjectId: 'CBSE-SCI-10',
    conceptId: 'CBSE-SCI10-CH10-C002',
    name: 'Ecology Food Chain Errors',
    description: 'Confuse trophic levels and energy transfer efficiencies.',
    triggerPatterns: ['thinks energy increases up chain', 'confuses producer/consumer'],
    correction: 'Use pyramid diagrams and energy loss examples across trophic levels.',
  },
  {
    id: 'CBSE-SCI10-MIS-018',
    subjectId: 'CBSE-SCI-10',
    conceptId: 'CBSE-SCI10-CH10-C004',
    name: 'Biological Classification Mix-ups',
    description: 'Misplace organisms in taxonomic ranks or confuse groups.',
    triggerPatterns: ['places mammal as reptile', 'confuses phylum and class'],
    correction: 'Review hierarchy with anchor examples and distinguishing features.',
  },
  {
    id: 'CBSE-SCI10-MIS-019',
    subjectId: 'CBSE-SCI-10',
    conceptId: 'CBSE-SCI10-CH11-C001',
    name: 'Chemical Bonding Misunderstanding',
    description: 'Confuse ionic and covalent bonding characteristics and electron behaviour.',
    triggerPatterns: ['thinks covalent transfers electrons', 'assumes ionic compounds are always solid only'],
    correction: 'Contrast electron-sharing vs transfer and show property differences.',
  },
  {
    id: 'CBSE-SCI10-MIS-020',
    subjectId: 'CBSE-SCI-10',
    conceptId: 'CBSE-SCI10-CH12-C003',
    name: 'Environmental Impact Attribution',
    description: 'Attribute ecosystem changes to single causes ignoring multiple interacting factors.',
    triggerPatterns: ['attributes decline to single pollutant', 'ignores habitat loss factor'],
    correction: 'Use multi-cause case studies and causal-mapping exercises.',
  },
]

export async function seedMisconceptions(prisma: PrismaClient, opts?: { dryRun?: boolean }) {
  for (const m of MISCONCEPTIONS_SCIENCE_GRADE10) {
    if (opts?.dryRun) continue
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
    })
  }
}

if (require.main === module) {
  const prisma = new PrismaClient()
  ;(async () => {
    try {
      await seedMisconceptions(prisma)
      console.log('Seeded science misconceptions')
    } catch (err) {
      console.error('Seed failed', err)
      process.exit(1)
    } finally {
      await prisma.$disconnect()
    }
  })()
}
