import { prisma } from '../prisma';
import type { Syllabus, SyllabusStatus, Prisma } from '@prisma/client';

// Reusable types
export type CreateSyllabusInput = {
  title: string;
  version: string;
  status: SyllabusStatus;
  json: Prisma.InputJsonValue;
};

export type SyllabusRecord = Syllabus;

/**
 * Persist a new Syllabus row.
 */
export async function createSyllabus(input: CreateSyllabusInput): Promise<SyllabusRecord> {
  try {
    const created = await prisma.syllabus.create({ data: { ...input, json: input.json as unknown as Prisma.InputJsonValue } });
    return created;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`createSyllabus failed: ${msg}`);
  }
}

/**
 * List syllabi with optional filters, ordered by `createdAt` DESC.
 */
export async function listSyllabi(filter?: { status?: SyllabusStatus; title?: string }): Promise<SyllabusRecord[]> {
  try {
    const where: any = {};
    if (filter?.status) where.status = filter.status;
    if (filter?.title) where.title = { contains: filter.title, mode: 'insensitive' };

    const rows = await prisma.syllabus.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return rows;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`listSyllabi failed: ${msg}`);
  }
}

/**
 * Return the most recent APPROVED syllabus for the given title, or null.
 */
export async function getLatestApprovedSyllabus(title: string): Promise<SyllabusRecord | null> {
  try {
    const row = await prisma.syllabus.findFirst({
      where: { title, status: 'APPROVED' as SyllabusStatus },
      orderBy: { createdAt: 'desc' },
    });
    return row;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`getLatestApprovedSyllabus failed: ${msg}`);
  }
}

const store = {
  createSyllabus,
  listSyllabi,
  getLatestApprovedSyllabus,
};

export default store;
