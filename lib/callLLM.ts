import OpenAI from "openai";
import { prisma } from "./prisma";

/**
 * -----------------------------
 * OpenAI Client
 * -----------------------------
 */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/**
 * -----------------------------
 * Model & Cost Configuration
 * -----------------------------
 * Update costs here if model pricing changes
 */
const MODEL = "gpt-4o-mini";

const COST_PER_1K = {
  input: 0.00015,   // USD per 1K input tokens
  output: 0.0006,   // USD per 1K output tokens
};

/**
 * -----------------------------
 * Types
 * -----------------------------
 */
export type CallLLMArgs = {
  prompt: string;
  promptType: string;

  board?: string;
  grade?: number;
  subject?: string;
  chapter?: string;
  topic?: string;
  language?: string;

  requestBody?: any;      // optional debug storage
  retries?: number;
};

/**
 * -----------------------------
 * callLLM – Single Source of Truth
 * -----------------------------
 */
export async function callLLM({
  prompt,
  promptType,
  retries = 3,
  requestBody,
  ...meta
}: CallLLMArgs): Promise<any> {
  let attempt = 0;

  while (attempt < retries) {
    try {
      const response = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.2,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
      });

      const usage = response.usage!;
      const rawContent = response.choices[0].message.content!;

      // Parse JSON strictly
      const parsed = JSON.parse(rawContent);

      // Cost calculation
      const costUsd =
        (usage.prompt_tokens / 1000) * COST_PER_1K.input +
        (usage.completion_tokens / 1000) * COST_PER_1K.output;

      // Persist log
      await prisma.aIContentLog.create({
        data: {
          model: MODEL,
          promptType,

          board: meta.board,
          grade: meta.grade,
          subject: meta.subject,
          chapter: meta.chapter,
          topic: meta.topic,
          language: meta.language,

          tokensIn: usage.prompt_tokens,
          tokensOut: usage.completion_tokens,
          tokensUsed: usage.total_tokens,

          costUsd: Number(costUsd.toFixed(6)),
          costCents: Math.round(costUsd * 100),

          success: true,
          status: "success",

          requestBody: requestBody ?? { prompt },
          responseBody: parsed,
        },
      });

      return parsed;
    } catch (error: any) {
      attempt++;

      // Final failure
      if (attempt >= retries) {
        await prisma.aIContentLog.create({
          data: {
            model: MODEL,
            promptType,

            board: meta.board,
            grade: meta.grade,
            subject: meta.subject,
            chapter: meta.chapter,
            topic: meta.topic,
            language: meta.language,

            success: false,
            status: "failed",
            error: error?.message ?? "Unknown error",

            requestBody: requestBody ?? { prompt },
          },
        });

        throw error;
      }

      // Exponential backoff
      await new Promise((resolve) =>
        setTimeout(resolve, attempt * 2000)
      );
    }
  }
}
