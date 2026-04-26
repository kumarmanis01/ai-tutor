/**
 * FILE OBJECTIVE:
 * - PromptService: Database-backed prompt versioning with Redis caching.
 * - Implements PR-1.2: DB storage, cache layer, fallback to registry.
 * - Ensures only one ACTIVE version per prompt type at any time.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ai/prompts/service.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-26T14:30:00Z | staff-engineer | created PromptService with DB + Redis (PR-1.2)
 * - 2026-04-26T07:34:23Z | copilot | fix: use named prisma import; type catch err as unknown
 * - 2026-04-26T07:41:39Z | copilot | fix: import PromptType/PromptStatus from local types.ts; replace PromptVersion Prisma model with local interface
 */

import { PromptType, PromptStatus, PromptVersionRecord as PromptVersion } from '@/lib/ai/prompt-registry/types';
import { prisma } from '@/lib/prisma';
import { getRedis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { PromptRegistry } from './registry';

const CACHE_TTL = 3600; // 1 hour in seconds (PR-1.2 spec)
const CACHE_KEY_PREFIX = 'prompt:v1:';

/**
 * PR-1.2: PromptService -- manages DB storage and Redis caching for prompt versions
 */
export class PromptService {
  /**
   * Get a prompt version by type and optional semantic version
   * Precedence: Cache → DB → Fallback to registry
   */
  static async getPrompt(type: PromptType, version?: string): Promise<PromptVersion | null> {
    try {
      const cacheKey = this.getCacheKey(type, version);

      // Try cache first
      const redis = getRedis();
      if (redis) {
        const cached = await redis.get(cacheKey).catch((err) => {
          logger.error('Redis cache get failed', { error: err.message, type });
          return null;
        });

        if (cached) {
          return JSON.parse(cached) as PromptVersion;
        }
      }

      // Query DB for specific version or latest ACTIVE
      let dbPrompt: PromptVersion | null = null;

      if (version) {
        dbPrompt = await prisma.promptVersion.findUnique({
          where: {
            promptType_version: { promptType: type, version },
          },
        });
      } else {
        // Get latest ACTIVE version
        dbPrompt = await prisma.promptVersion.findFirst({
          where: {
            promptType: type,
            status: PromptStatus.ACTIVE,
          },
          orderBy: { createdAt: 'desc' },
        });
      }

      // Cache if found
      if (dbPrompt && redis) {
        await redis
          .setex(cacheKey, CACHE_TTL, JSON.stringify(dbPrompt))
          .catch((err) => {
            logger.warn('Redis cache set failed', { error: err.message, type });
          });
      }

      return dbPrompt;
    } catch (error) {
      logger.error('PromptService.getPrompt failed, falling back to registry', {
        type,
        version,
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback to in-memory registry
      const registryPrompt = PromptRegistry.getPrompt(type, version);
      if (registryPrompt) {
        // Convert registry prompt to DB format for consistency
        return {
          id: registryPrompt.id,
          promptType: registryPrompt.type,
          version: registryPrompt.version,
          systemPrompt: registryPrompt.systemPrompt,
          userPromptTemplate: registryPrompt.userPromptBuilder({}),
          modelName: registryPrompt.model,
          maxTokens: registryPrompt.maxTokens,
          temperature: registryPrompt.temperature,
          status: registryPrompt.status,
          changeNotes: null,
          createdBy: null,
          performanceScore: 0,
          usageCount: 0,
          avgLatencyMs: null,
          avgTokenUsage: null,
          createdAt: registryPrompt.createdAt,
          updatedAt: registryPrompt.lastModifiedAt,
        } as PromptVersion;
      }

      return null;
    }
  }

  /**
   * List all prompts with optional filtering
   */
  static async listPrompts(filter?: {
    status?: PromptStatus;
    type?: PromptType;
  }): Promise<PromptVersion[]> {
    try {
      const prompts = await prisma.promptVersion.findMany({
        where: {
          ...(filter?.status && { status: filter.status }),
          ...(filter?.type && { promptType: filter.type }),
        },
        orderBy: [{ promptType: 'asc' }, { createdAt: 'desc' }],
      });

      return prompts;
    } catch (error) {
      logger.error('PromptService.listPrompts failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get the active version string for a prompt type
   */
  static async getActiveVersion(type: PromptType): Promise<string | null> {
    const prompt = await this.getPrompt(type);
    return prompt?.version || null;
  }

  /**
   * Create a new prompt version as DRAFT
   * Returns the created PromptVersion
   */
  static async createDraftPrompt(input: {
    promptType: PromptType;
    version: string;
    systemPrompt: string;
    userPromptTemplate: string;
    modelName: string;
    maxTokens: number;
    temperature: number;
    changeNotes?: string;
    createdBy?: string;
  }): Promise<PromptVersion> {
    const prompt = await prisma.promptVersion.create({
      data: {
        ...input,
        status: PromptStatus.DRAFT,
      },
    });

    // Invalidate any cached listings
    await this.invalidateCache(input.promptType);

    return prompt;
  }

  /**
   * Activate a prompt version (deactivate previous ACTIVE if exists)
   * Ensures only one ACTIVE version per prompt type (PR-1.2)
   */
  static async activatePrompt(id: string): Promise<PromptVersion> {
    const prompt = await prisma.promptVersion.findUnique({ where: { id } });

    if (!prompt) {
      throw new Error(`Prompt version ${id} not found`);
    }

    // Deactivate previous ACTIVE version for this type
    await prisma.promptVersion.updateMany({
      where: {
        promptType: prompt.promptType,
        status: PromptStatus.ACTIVE,
      },
      data: { status: PromptStatus.TESTING }, // Move to TESTING instead of DEPRECATED
    });

    // Activate the target version
    const activated = await prisma.promptVersion.update({
      where: { id },
      data: { status: PromptStatus.ACTIVE },
    });

    // Invalidate cache to ensure latest is fetched
    await this.invalidateCache(prompt.promptType);

    logger.info('Prompt version activated', {
      promptType: prompt.promptType,
      version: prompt.version,
      id,
    });

    return activated;
  }

  /**
   * Deprecate a prompt version
   */
  static async deprecatePrompt(id: string): Promise<PromptVersion> {
    const deprecated = await prisma.promptVersion.update({
      where: { id },
      data: { status: PromptStatus.DEPRECATED },
    });

    // Invalidate cache
    const prompt = await prisma.promptVersion.findUnique({ where: { id } });
    if (prompt) {
      await this.invalidateCache(prompt.promptType);
    }

    logger.info('Prompt version deprecated', { id, version: deprecated.version });

    return deprecated;
  }

  /**
   * Invalidate Redis cache for a prompt type
   */
  private static async invalidateCache(type: PromptType): Promise<void> {
    try {
      const redis = getRedis();
      if (!redis) return;

      // Delete all variants of cache key for this type
      const pattern = `${CACHE_KEY_PREFIX}${type}*`;
      const keys = await redis.keys(pattern).catch(() => [] as string[]);

      if (keys.length > 0) {
        await redis.del(...keys).catch((err) => {
          logger.warn('Failed to invalidate cache', { type, error: err.message });
        });
      }
    } catch (error) {
      logger.warn('Cache invalidation failed', {
        type,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Generate cache key for a prompt
   */
  private static getCacheKey(type: PromptType, version?: string): string {
    return version ? `${CACHE_KEY_PREFIX}${type}:${version}` : `${CACHE_KEY_PREFIX}${type}:active`;
  }

  /**
   * Log a generation with prompt version (PR-3.1)
   * Non-blocking async operation
   */
  static async logGeneration(input: {
    promptType: PromptType;
    promptVersion: string;
    requestVariables?: unknown;
    responseText?: string;
    requestTokens?: number;
    responseTokens?: number;
    latencyMs?: number;
    modelName?: string;
    success: boolean;
    errorMessage?: string;
    qualityScore?: number;
    userId?: string;
  }): Promise<void> {
    // Fire and forget -- don't block on logging
    prisma.aIGenerationLog
      .create({
        data: {
          promptType: input.promptType,
          promptVersion: input.promptVersion,
          requestVariables: input.requestVariables as unknown,
          responseText: input.responseText,
          requestTokens: input.requestTokens,
          responseTokens: input.responseTokens,
          latencyMs: input.latencyMs,
          modelName: input.modelName,
          success: input.success,
          errorMessage: input.errorMessage,
          qualityScore: input.qualityScore,
          userId: input.userId,
          totalTokens:
            input.requestTokens && input.responseTokens
              ? input.requestTokens + input.responseTokens
              : undefined,
        },
      })
      .catch((err: unknown) => {
        logger.warn('Failed to log generation', {
          promptType: input.promptType,
          error: err instanceof Error ? err.message : String(err),
        });
      });
  }
}
