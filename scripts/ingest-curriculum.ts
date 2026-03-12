import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'

const BATCH_SIZE = 20
const MODEL = 'text-embedding-3-small'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set. Aborting.')
    process.exit(1)
  }

  const totalResult = (await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*)::bigint AS count FROM "CurriculumChunk" WHERE embedding IS NULL`,
  )) as { count: bigint }[]
  const total = Number(totalResult?.[0]?.count ?? 0)
  if (!total) {
    console.log('No CurriculumChunk rows without embeddings. Nothing to do.')
    process.exit(0)
  }

  console.log(`Found ${total} CurriculumChunk rows without embeddings.`)

  let embedded = 0

  while (true) {
    const rows = (await prisma.$queryRawUnsafe<
      { id: string; content: string | null }[]
    >(
      `
        SELECT id, content
        FROM "CurriculumChunk"
        WHERE embedding IS NULL
        ORDER BY id
        LIMIT $1
      `,
      BATCH_SIZE,
    )) as { id: string; content: string | null }[]

    if (!rows.length) break

    const inputs = rows.map((r) => (r.content && r.content.trim().length > 0 ? r.content : ' '))

    const resp = await openai.embeddings.create({
      model: MODEL,
      input: inputs,
    })

    if (!resp.data || resp.data.length !== rows.length) {
      console.warn(
        `Embedding response size mismatch: got ${resp.data?.length ?? 0}, expected ${rows.length}. Skipping batch.`,
      )
      continue
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const embedding = resp.data[i]?.embedding
      if (!Array.isArray(embedding) || embedding.length === 0) {
        continue
      }

      const literal = `[${embedding.join(',')}]`
      await prisma.$executeRawUnsafe(
        `UPDATE "CurriculumChunk" SET embedding = $1::vector WHERE id = $2`,
        literal,
        row.id,
      )
      embedded += 1
    }

    console.log(`Embedded ${embedded}/${total} chunks`)
  }

  console.log('Done.')
}

main()
  .catch((err) => {
    console.error('Error ingesting curriculum embeddings', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

