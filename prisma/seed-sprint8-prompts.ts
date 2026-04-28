/**
 * FILE OBJECTIVE:
 * - Seed script for Sprint 8: Creates all 9 prompt types at v1.0.0 (ACTIVE status).
 * - Implements PR-1.2: Seeds MVP prompts from PromptRegistry into database.
 *
 * LINKED UNIT TEST:
 * - tests/unit/prisma/seed.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-04-26T15:30:00Z | staff-engineer | created seed script for Sprint 8 prompts
 */

import { PrismaClient, PromptType, PromptStatus } from '@prisma/client';
import { PromptRegistry } from '@/lib/ai/prompts/registry';

const prisma = new PrismaClient();

async function seedPrompts() {
  console.log('🌱 Seeding prompt versions (Sprint 8)...');

  // Get all prompt types from registry
  const allTypes = PromptRegistry.getAllPromptTypes();

  for (const type of allTypes) {
    try {
      const registryPrompt = PromptRegistry.getPrompt(type, '1.0.0');
      if (!registryPrompt) {
        console.warn(`⚠️  No registry entry for ${type}`);
        continue;
      }

      // Check if v1.0.0 already exists
      const existing = await prisma.promptVersion.findUnique({
        where: {
          promptType_version: {
            promptType: type,
            version: '1.0.0',
          },
        },
      });

      if (existing) {
        console.log(`✓ ${type} v1.0.0 already exists`);
        continue;
      }

      // Create v1.0.0 as ACTIVE
      const created = await prisma.promptVersion.create({
        data: {
          promptType: type,
          version: '1.0.0',
          systemPrompt: registryPrompt.systemPrompt,
          userPromptTemplate: registryPrompt.userPromptBuilder({}),
          modelName: registryPrompt.model,
          maxTokens: registryPrompt.maxTokens,
          temperature: registryPrompt.temperature,
          status: PromptStatus.ACTIVE,
          changeNotes: 'Initial MVP prompt for Sprint 8 launch',
          createdBy: 'seed-script',
          performanceScore: 0,
          usageCount: 0,
        },
      });

      console.log(`✓ Created ${type} v1.0.0 (${created.id})`);
    } catch (error) {
      console.error(`✗ Failed to seed ${type}:`, error);
    }
  }

  // Also create variable schemas for each prompt type
  console.log('\n🌱 Seeding prompt variable schemas...');
  for (const type of allTypes) {
    try {
      const existing = await prisma.promptVariableSchema.findUnique({
        where: { promptType: type },
      });

      if (existing) {
        console.log(`✓ Schema for ${type} already exists`);
        continue;
      }

      // Schemas are defined in PromptVariableValidator
      // Here we store the JSON schema representation (simplified for now)
      const schema = {
        type: 'object',
        properties: {
          // Properties defined per type in validator.ts
        },
      };

      await prisma.promptVariableSchema.create({
        data: {
          promptType: type,
          schema,
        },
      });

      console.log(`✓ Created variable schema for ${type}`);
    } catch (error) {
      console.error(`✗ Failed to seed schema for ${type}:`, error);
    }
  }

  console.log('\n✅ Prompt seeding complete!');
}

async function main() {
  try {
    await seedPrompts();
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
