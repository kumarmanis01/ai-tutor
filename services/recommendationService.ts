/**
 * FILE OBJECTIVE:
 * - RecommendationService: fetches personalized recommendations via LLM,
 *   caches results in Redis (TTL 900s), and falls back to DEFAULT_RECOMMENDATIONS
 *   on any error. Provides cache invalidation for click events.
 *
 * EDIT LOG:
 * - 2026-06-08T02:00:00Z | claude | fix: check Redis cache before building context to avoid 6 wasted DB queries on cache hits; use env-configured model name; lazy-init OpenAI singleton
 * - 2026-06-08T00:00:00Z | claude | initial: recommendation service with Redis cache + OpenAI
 */

import OpenAI from 'openai';
import type { Redis } from 'ioredis';
import type { PrismaClient } from '@prisma/client';
import { buildRecommendationContext } from '@/services/recommendationContextBuilder';
import {
  buildRecommendationPrompt,
  RECOMMENDATION_SYSTEM_PROMPT,
} from '@/prompts/recommendation';
import type { Recommendation, RecommendationResult } from '@/types/recommendation';
import { logger } from '@/lib/logger';

const CACHE_KEY_PREFIX = 'reco:v1:';
const CACHE_TTL_SECONDS = 900; // 15 minutes
const LLM_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4.1';
const LLM_MAX_TOKENS = 800;
const LLM_TEMPERATURE = 0.4;

const DEFAULT_RECOMMENDATIONS: Recommendation[] = [
  {
    id: 'doubt_clearance-general',
    type: 'doubt_clearance',
    title: 'Ask your first question',
    prompt: 'Explain a concept I find confusing in simple terms.',
    reason: 'Starting with a doubt is the fastest way to learn.',
    relevanceScore: 0.8,
  },
  {
    id: 'practice_test-general',
    type: 'practice_test',
    title: 'Try a practice test',
    prompt: 'Give me 5 mixed difficulty questions to test my knowledge.',
    reason: 'Testing yourself reveals gaps faster than re-reading notes.',
    relevanceScore: 0.7,
  },
  {
    id: 'new_concept-general',
    type: 'new_concept',
    title: 'Explore a new concept',
    prompt: 'What is the most important concept I should learn next?',
    reason: 'Building on what you know is the most effective study path.',
    relevanceScore: 0.6,
  },
];

export class RecommendationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly openai: OpenAI
  ) {}

  /**
   * Returns personalized recommendations for a user.
   * Checks Redis cache first; calls OpenAI on miss; falls back to defaults on error.
   */
  async getRecommendations(userId: string): Promise<RecommendationResult> {
    const cacheKey = `${CACHE_KEY_PREFIX}${userId}`;

    // Check cache before building context — avoids 6 DB queries on every cache hit
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as RecommendationResult;
        return { ...parsed, cached: true };
      }
    } catch (err) {
      logger.warn('recommendation.cache.read_failed', {
        event: 'recommendation.cache.read_failed',
        context: { userId, error: String(err) },
      });
    }

    // Cache miss — build context then call LLM
    const context = await buildRecommendationContext(userId, this.prisma);

    let recommendations: Recommendation[];
    try {
      const prompt = buildRecommendationPrompt(context);
      const response = await this.openai.chat.completions.create({
        model: LLM_MODEL,
        max_tokens: LLM_MAX_TOKENS,
        temperature: LLM_TEMPERATURE,
        messages: [
          { role: 'system', content: RECOMMENDATION_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
      });

      const raw = response.choices[0]?.message?.content ?? '';
      recommendations = this.parseRecommendations(raw);
    } catch (err) {
      logger.error('recommendation.llm.failed', {
        event: 'recommendation.llm.failed',
        context: { userId, error: String(err) },
      });
      return this.buildDefaultResult(context);
    }

    // Sort by relevanceScore descending
    recommendations.sort((a, b) => b.relevanceScore - a.relevanceScore);

    const result: RecommendationResult = {
      recommendations,
      context: {
        weakTopics: context.weakTopics,
        lastTestScore: context.lastTestScore,
      },
      cached: false,
      generatedAt: new Date().toISOString(),
    };

    // Cache result
    try {
      await this.redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_SECONDS);
    } catch (err) {
      logger.warn('recommendation.cache.write_failed', {
        event: 'recommendation.cache.write_failed',
        context: { userId, error: String(err) },
      });
    }

    return result;
  }

  /** Deletes the Redis cache entry for a user (called after CLICK events). */
  async invalidateCache(userId: string): Promise<void> {
    try {
      await this.redis.del(`${CACHE_KEY_PREFIX}${userId}`);
    } catch (err) {
      logger.warn('recommendation.cache.invalidate_failed', {
        event: 'recommendation.cache.invalidate_failed',
        context: { userId, error: String(err) },
      });
    }
  }

  private parseRecommendations(raw: string): Recommendation[] {
    try {
      // Strip markdown fences if the model disobeyed instructions
      const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
      const parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('LLM returned empty or non-array response');
      }
      // Validate and coerce each item
      return parsed
        .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
        .map((item) => ({
          id: String(item.id ?? `reco-${Math.random().toString(36).slice(2)}`),
          type: this.coerceType(item.type),
          title: String(item.title ?? 'Study recommendation').slice(0, 80),
          prompt: String(item.prompt ?? 'How can I improve my understanding?').slice(0, 200),
          reason: String(item.reason ?? 'Based on your learning history.').slice(0, 300),
          relevanceScore: Math.min(1, Math.max(0, Number(item.relevanceScore ?? 0.5))),
          topic: item.topic ? String(item.topic) : undefined,
        }));
    } catch (err) {
      logger.error('recommendation.parse.failed', {
        event: 'recommendation.parse.failed',
        context: { error: String(err), rawLength: raw.length },
      });
      return DEFAULT_RECOMMENDATIONS;
    }
  }

  private coerceType(
    raw: unknown
  ): 'topic_review' | 'practice_test' | 'new_concept' | 'doubt_clearance' {
    const valid = ['topic_review', 'practice_test', 'new_concept', 'doubt_clearance'];
    return valid.includes(String(raw)) ? (raw as ReturnType<typeof this.coerceType>) : 'new_concept';
  }

  private buildDefaultResult(
    context: Awaited<ReturnType<typeof buildRecommendationContext>>
  ): RecommendationResult {
    return {
      recommendations: DEFAULT_RECOMMENDATIONS,
      context: {
        weakTopics: context.weakTopics,
        lastTestScore: context.lastTestScore,
      },
      cached: false,
      generatedAt: new Date().toISOString(),
    };
  }
}
