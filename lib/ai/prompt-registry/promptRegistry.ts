/**
 * FILE OBJECTIVE:
 * - Implement in-memory prompt registry operations for prompt retrieval and filtering.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ai/prompt-registry/promptRegistry.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-26T15:00:00Z | copilot | created PromptRegistry with getPrompt/listPrompts/getActiveVersion
 */

import { PromptConfig, PromptListFilter, PromptStatus, PromptType } from './types';

function parseVersion(version: string): number[] {
  const cleaned = version.replace(/^v/i, '');
  return cleaned.split('.').map((part) => Number(part) || 0);
}

function compareVersionDesc(left: string, right: string): number {
  const l = parseVersion(left);
  const r = parseVersion(right);
  const maxLength = Math.max(l.length, r.length);
  for (let i = 0; i < maxLength; i += 1) {
    const lv = l[i] ?? 0;
    const rv = r[i] ?? 0;
    if (lv > rv) return -1;
    if (lv < rv) return 1;
  }
  return 0;
}

export class PromptRegistry {
  private readonly registryByType: Map<PromptType, PromptConfig[]>;

  constructor(prompts: ReadonlyArray<PromptConfig>) {
    this.registryByType = new Map<PromptType, PromptConfig[]>();
    for (const prompt of prompts) {
      const bucket = this.registryByType.get(prompt.type) ?? [];
      bucket.push(prompt);
      this.registryByType.set(prompt.type, bucket);
    }

    for (const [key, value] of this.registryByType.entries()) {
      this.registryByType.set(
        key,
        [...value].sort((a, b) => compareVersionDesc(a.version, b.version))
      );
    }
  }

  getPrompt(type: PromptType, version?: string): PromptConfig {
    const prompts = this.registryByType.get(type) ?? [];
    if (prompts.length === 0) {
      throw new Error(`Prompt type not found: ${type}`);
    }

    if (version) {
      const exact = prompts.find((item) => item.version === version);
      if (!exact) {
        throw new Error(`Prompt version not found: ${type}@${version}`);
      }
      return exact;
    }

    const active = prompts.find((item) => item.status === PromptStatus.ACTIVE);
    if (active) return active;

    return prompts[0];
  }

  listPrompts(filter: PromptListFilter = {}): PromptConfig[] {
    const all = Array.from(this.registryByType.values()).flatMap((items) => items);
    return all.filter((item) => {
      if (filter.type && item.type !== filter.type) return false;
      if (filter.status && item.status !== filter.status) return false;
      return true;
    });
  }

  getActiveVersion(type: PromptType): string {
    return this.getPrompt(type).version;
  }
}
