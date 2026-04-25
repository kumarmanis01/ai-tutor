import { z } from 'zod';

export const MisconceptionCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  correction: z.string().min(1),
  triggerPatterns: z.array(z.string().min(1)).min(2),
  prevalenceRate: z.number().min(0).max(1).optional(),
  subjectId: z.string().min(1),
  conceptId: z.string().min(1),
});

export const MisconceptionPatchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  correction: z.string().optional(),
  triggerPatterns: z.array(z.string().min(1)).min(2).optional(),
  prevalenceRate: z.number().min(0).max(1).optional(),
  subjectId: z.string().min(1).optional(),
  conceptId: z.string().min(1).optional(),
});

export type MisconceptionCreate = z.infer<typeof MisconceptionCreateSchema>;
export type MisconceptionPatch = z.infer<typeof MisconceptionPatchSchema>;
