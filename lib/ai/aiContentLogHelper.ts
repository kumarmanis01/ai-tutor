// lightweight helper: accept either a Prisma client-like object or any test stub
type PrismaLike = any

export async function createStartedAIContentLog(db: PrismaLike, params: {
  model?: string
  promptType: string
  board?: string | null
  grade?: number | null
  subject?: string | null
  chapter?: string | null
  topic?: string | null
  language?: string
  requestBody?: any
  renderer?: { schemaHash?: string | null; version?: string | number | null }
}) {
  const data: any = {
    model: params.model ?? 'pending',
    promptType: params.promptType,
    board: params.board ?? null,
    grade: params.grade ?? null,
    subject: params.subject ?? null,
    chapter: params.chapter ?? null,
    topic: params.topic ?? null,
    language: params.language ?? 'en',
    success: false,
    status: 'started',
    requestBody: params.requestBody ?? null,
    responseBody: null
  }

  if (params.renderer) {
    data.requestBody = data.requestBody || {}
    data.requestBody.renderer = { schemaHash: params.renderer.schemaHash ?? null, version: params.renderer.version ?? null }
  }

  return db.aIContentLog.create({ data })
}

export async function finalizeAIContentLog(db: PrismaLike, id: string, updates: {
  success: boolean
  model?: string
  tokensIn?: number | null
  tokensOut?: number | null
  tokensUsed?: number | null
  costUsd?: number | null
  responseBody?: any
  error?: string | null
  status?: string
  extra?: any
}) {
  const data: any = {
    success: updates.success,
    model: updates.model ?? undefined,
    tokensIn: updates.tokensIn ?? undefined,
    tokensOut: updates.tokensOut ?? undefined,
    tokensUsed: updates.tokensUsed ?? undefined,
    costUsd: updates.costUsd ?? undefined,
    responseBody: updates.responseBody ?? undefined,
    error: updates.error ?? undefined,
    status: updates.status ?? (updates.success ? 'success' : 'failed')
  }

  // remove undefined fields to avoid Prisma complaining
  Object.keys(data).forEach((k) => data[k] === undefined && delete data[k])

  return db.aIContentLog.update({ where: { id }, data })
}

export default { createStartedAIContentLog, finalizeAIContentLog }
