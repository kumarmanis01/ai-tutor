import { prisma } from '../prisma';

// Reusable types (use lightweight types to avoid relying on named Prisma exports
// during the worker build; these are compatible with the generated client at runtime)
export type CreateSyllabusInput = {
  title: string;
  version: string;
  status: string;
  json: any;
};

export type SyllabusRecord = any;

/**
 * Persist a new Syllabus row.
 */
export async function createSyllabus(input: CreateSyllabusInput): Promise<SyllabusRecord> {
  try {
    const created = await prisma.syllabus.create({ data: { ...input, json: input.json } });
    return created;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`createSyllabus failed: ${msg}`);
  }
}

/**
 * List syllabi with optional filters, ordered by `createdAt` DESC.
 */
export async function listSyllabi(filter?: { status?: string; title?: string }): Promise<SyllabusRecord[]> {
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
      where: { title, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
    });
    return row;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`getLatestApprovedSyllabus failed: ${msg}`);
  }
}

/**
 * Ensure a syllabus is mutable (not APPROVED). Throws if immutable.
 */
async function ensureMutable(id: string) {
  const s = await prisma.syllabus.findUnique({ where: { id } });
  if (!s) throw new Error('Syllabus not found');
  if (s.status === 'APPROVED') throw new Error('Syllabus is approved and immutable');
  return s;
}

/**
 * Update a syllabus row if it's not approved. Returns the updated record.
 */
export async function updateSyllabus(id: string, data: Partial<{ title: string; version: string; json: any; status?: string }>): Promise<SyllabusRecord> {
  try {
    await ensureMutable(id);
    const updated = await prisma.syllabus.update({ where: { id }, data: data as any });
    return updated;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`updateSyllabus failed: ${msg}`);
  }
}

/**
 * Delete a syllabus row unless it's approved.
 */
export async function deleteSyllabus(id: string): Promise<void> {
  try {
    await ensureMutable(id);
    await prisma.syllabus.delete({ where: { id } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`deleteSyllabus failed: ${msg}`);
  }
}


const store = {
  createSyllabus,
  listSyllabi,
  getLatestApprovedSyllabus,
  updateSyllabus,
  deleteSyllabus,
};

export default store;
