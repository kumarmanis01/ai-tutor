/**
 * FILE OBJECTIVE:
 * - Provide DB-backed prompt version service with Redis caching and hardcoded fallback.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ai/prompt-registry/promptService.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-26T15:00:00Z | copilot | created PromptService with DB cache and fallback registry support
 * - 2026-04-26T07:00:56Z | copilot | switch Prisma enum import from PromptTypeEnum to PromptType after schema deduplication
 * - 2026-04-26T07:50:16Z | copilot | remove direct Prisma enum imports to avoid TS2614 during VPS pre-flight type check
 * - 2026-04-26T07:55:36Z | copilot | fix TS2693 by replacing PrismaPromptStatus value usage with PromptStatus constants
 * - 2026-04-26T08:03:49Z | copilot | restore Prisma enum imports for DB-facing assignments to satisfy worker build type checks
 * - 2026-04-26T08:03:49Z | copilot | replace named Prisma enum imports with Prisma namespace aliases to avoid TS2614
 * - 2026-04-26T09:10:00Z | copilot | replace Prisma.$Enums type references with direct @prisma/client enum imports for VPS compiler compatibility
 * - 2026-04-26T09:25:00Z | copilot | remove direct Prisma enum imports and rely on string-safe local enum casts for broader client compatibility
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { cacheDelPattern, cacheGet, cacheSet } from '@/lib/cache';
import {
  PromptConfig,
  PromptListDbFilter,
  PromptStatus,
  PromptType,
  PromptVariables,
  PromptVersionRecord,
} from './types';
import { buildUserPromptFromTemplate, DEFAULT_PROMPTS } from './defaults';
import { PromptRegistry } from './promptRegistry';

const CACHE_TTL_SECONDS = 60 * 60;
const CACHE_KEY = 'prompts:registry:v1:all';
const FALLBACK_REGISTRY = new PromptRegistry(DEFAULT_PROMPTS);

function toPromptType(value: PrismaPromptType): PromptType {
  return value as unknown as PromptType;
}

function toPromptStatus(value: PrismaPromptStatus): PromptStatus {
  return value as unknown as PromptStatus;
}

function toPrismaPromptType(value: PromptType): PrismaPromptType {
  return value as unknown as PrismaPromptType;
}

function toPrismaPromptStatus(value: PromptStatus): PrismaPromptStatus {
  return value as unknown as PrismaPromptStatus;
}

type PrismaPromptType = string;
type PrismaPromptStatus = string;

function toPromptConfig(record: PromptVersionRecord): PromptConfig {
  return {
    id: record.id,
    type: record.promptType,
    version: record.version,
    systemPrompt: record.systemPrompt,
    userPromptBuilder: (variables: PromptVariables) =>
      buildUserPromptFromTemplate(record.userPromptTemplate, variables),
    model: record.modelName,
    maxTokens: record.maxTokens,
    temperature: record.temperature,
    createdAt: record.createdAt.toISOString(),
    lastModifiedAt: record.updatedAt.toISOString(),
    status: record.status,
  };
}

function toPromptVersionRecord(record: {
  id: string;
  promptType: PrismaPromptType;
  version: string;
  systemPrompt: string;
  userPromptTemplate: string;
  modelName: string;
  maxTokens: number;
  temperature: number;
  status: PrismaPromptStatus;
  changeNotes: string | null;
  createdBy: string | null;
  performanceScore: number | null;
  usageCount: number;
  avgLatencyMs: number | null;
  avgTokenUsage: number | null;
  createdAt: Date;
  updatedAt: Date;
}): PromptVersionRecord {
  return {
    id: record.id,
    promptType: toPromptType(record.promptType),
    version: record.version,
    systemPrompt: record.systemPrompt,
    userPromptTemplate: record.userPromptTemplate,
    modelName: record.modelName,
    maxTokens: record.maxTokens,
    temperature: record.temperature,
    status: toPromptStatus(record.status),
    changeNotes: record.changeNotes,
    createdBy: record.createdBy,
    performanceScore: record.performanceScore,
    usageCount: record.usageCount,
    avgLatencyMs: record.avgLatencyMs,
    avgTokenUsage: record.avgTokenUsage,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export interface CreatePromptVersionInput {
  promptType: PromptType;
  version: string;
  systemPrompt: string;
  userPromptTemplate: string;
  modelName: string;
  maxTokens: number;
  temperature: number;
  changeNotes?: string;
  createdBy?: string;
}

export interface UpdatePromptVersionInput {
  systemPrompt?: string;
  userPromptTemplate?: string;
  modelName?: string;
  maxTokens?: number;
  temperature?: number;
  changeNotes?: string;
}

export class PromptService {
  async getPrompt(type: PromptType, version?: string): Promise<PromptConfig> {
    try {
      const records = await this.listPromptRecords({ type });
      const registry = new PromptRegistry(records.map((item) => toPromptConfig(item)));
      return registry.getPrompt(type, version);
    } catch (error) {
      logger.warn('prompt_service.get_prompt_fallback', { type, version, error: String(error) });
      return FALLBACK_REGISTRY.getPrompt(type, version);
    }
  }

  async listPrompts(filter: PromptListDbFilter = {}): Promise<PromptConfig[]> {
    try {
      const records = await this.listPromptRecords(filter);
      return records.map((item) => toPromptConfig(item));
    } catch (error) {
      logger.warn('prompt_service.list_prompts_fallback', { error: String(error), filter });
      return FALLBACK_REGISTRY.listPrompts(filter);
    }
  }

  async getActiveVersion(type: PromptType): Promise<string> {
    const prompt = await this.getPrompt(type);
    return prompt.version;
  }

  async getPromptVersionById(id: string): Promise<PromptVersionRecord | null> {
    const row = await prisma.promptVersion.findUnique({ where: { id } });
    if (!row) return null;
    return toPromptVersionRecord(row);
  }

  async createPromptVersion(input: CreatePromptVersionInput): Promise<PromptVersionRecord> {
    const row = await prisma.promptVersion.create({
      data: {
        promptType: toPrismaPromptType(input.promptType),
        version: input.version,
        systemPrompt: input.systemPrompt,
        userPromptTemplate: input.userPromptTemplate,
        modelName: input.modelName,
        maxTokens: input.maxTokens,
        temperature: input.temperature,
        status: toPrismaPromptStatus(PromptStatus.DRAFT),
        changeNotes: input.changeNotes ?? null,
        createdBy: input.createdBy ?? null,
      },
    });

    await this.invalidateCache();
    return toPromptVersionRecord(row);
  }

  async updateDraftPromptVersion(
    id: string,
    input: UpdatePromptVersionInput
  ): Promise<PromptVersionRecord | null> {
    const existing = await prisma.promptVersion.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!existing || existing.status !== toPrismaPromptStatus(PromptStatus.DRAFT)) {
      return null;
    }

    const row = await prisma.promptVersion.update({
      where: { id },
      data: {
        systemPrompt: input.systemPrompt,
        userPromptTemplate: input.userPromptTemplate,
        modelName: input.modelName,
        maxTokens: input.maxTokens,
        temperature: input.temperature,
        changeNotes: input.changeNotes,
      },
    });

    await this.invalidateCache();
    return toPromptVersionRecord(row);
  }

  async activatePromptVersion(id: string): Promise<PromptVersionRecord | null> {
    const existing = await prisma.promptVersion.findUnique({ where: { id } });
    if (!existing) return null;

    const row = await prisma.$transaction(async (tx) => {
      await tx.promptVersion.updateMany({
        where: {
          promptType: existing.promptType,
          status: toPrismaPromptStatus(PromptStatus.ACTIVE),
          NOT: { id },
        },
        data: { status: toPrismaPromptStatus(PromptStatus.DEPRECATED) },
      });

      return tx.promptVersion.update({
        where: { id },
        data: { status: toPrismaPromptStatus(PromptStatus.ACTIVE) },
      });
    });

    await this.invalidateCache();
    return toPromptVersionRecord(row);
  }

  async deprecatePromptVersion(id: string): Promise<PromptVersionRecord | null> {
    try {
      const row = await prisma.promptVersion.update({
        where: { id },
        data: { status: toPrismaPromptStatus(PromptStatus.DEPRECATED) },
      });
      await this.invalidateCache();
      return toPromptVersionRecord(row);
    } catch {
      return null;
    }
  }

  private async listPromptRecords(filter: PromptListDbFilter = {}): Promise<PromptVersionRecord[]> {
    const { status, type } = filter;

    const useCache = !status && !type && !filter.page && !filter.pageSize;
    if (useCache) {
      const cached = await cacheGet<PromptVersionRecord[]>(CACHE_KEY);
      if (cached && Array.isArray(cached)) {
        return cached.map((entry) => ({
          ...entry,
          createdAt: new Date(entry.createdAt),
          updatedAt: new Date(entry.updatedAt),
        }));
      }
    }

    const page = Math.max(1, filter.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20));

    const rows = await prisma.promptVersion.findMany({
      where: {
        promptType: type ? toPrismaPromptType(type) : undefined,
        status: status ? toPrismaPromptStatus(status) : undefined,
      },
      orderBy: [{ promptType: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const mapped = rows.map((item: Parameters<typeof toPromptVersionRecord>[0]) => toPromptVersionRecord(item));

    if (useCache) {
      await cacheSet(CACHE_KEY, mapped, CACHE_TTL_SECONDS);
    }

    return mapped;
  }

  private async invalidateCache(): Promise<void> {
    await cacheDelPattern('prompts:registry:v1:*');
  }
}

export const promptService = new PromptService();
