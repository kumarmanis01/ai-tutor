import { prisma } from '@/lib/prisma'

// Simple benchmark to seed synthetic vectors into DoubtKb and measure retrieval latency
// Usage (example):
//   DATABASE_URL=postgres://... SUBJECT_ID=biology N=5000 PROBES=1000 tsx scripts/perf/doubtkb_bench.ts

const DIM = Number(process.env.DIM) || 1536
const N = Number(process.env.N) || 5000
const SUBJECT_ID = process.env.SUBJECT_ID || 'perf-subject'
const TRIALS = Number(process.env.TRIALS) || 200
const LISTS = Number(process.env.LISTS) || 100

function randVec(dim: number) {
  // generate random vector with values in [-1,1]
  const v = Array.from({ length: dim }, () => (Math.random() * 2 - 1))
  return v
}

function vecLiteral(v: number[]) {
  return `[${v.join(',')}]`
}

async function seed() {
  console.log(`Seeding ${N} rows (dim=${DIM}) for subject=${SUBJECT_ID} ...`)
  const batch = 200
  const ids: string[] = []
  for (let i = 0; i < N; i += batch) {
    const chunk = Math.min(batch, N - i)
    const values: string[] = []
    const params: any[] = []
    for (let j = 0; j < chunk; j++) {
      const q = `seed ${i + j} ${Date.now()}`
      const a = `answer ${i + j}`
      const vec = randVec(DIM)
      const lit = vecLiteral(vec)
      // Insert minimal fields; use embedding update after insert
      values.push(`('shared','shared',NULL,${escapeLiteral(q)},${escapeLiteral(a)},${escapeLiteral(SUBJECT_ID)},NULL,NULL,NULL,NULL,NULL)`)
    }

    // Insert rows using prisma.$executeRawUnsafe with VALUES clause
    const sql = `INSERT INTO "DoubtKb" ("studentId","sessionId","conceptId","question","answer","subjectId","questionText","answerText","embedding","timesServed","alternatePhrasings") VALUES ${values.join(',')} RETURNING id`
    try {
      const res: any[] = await prisma.$queryRawUnsafe(sql)
      for (const r of res) ids.push(r.id)
    } catch (err) {
      console.error('seed insert error', err)
      throw err
    }
  }
  console.log(`Seeded ${ids.length} rows`)
  return ids
}

function escapeLiteral(s: string) {
  return `'${String(s).replace(/'/g, "''")}'`
}

async function ensureIvfflat(lists = LISTS) {
  console.log('Ensuring ivfflat index exists...')
  const sql = `CREATE INDEX IF NOT EXISTS "DoubtKb_embedding_ivfflat_idx" ON "DoubtKb" USING ivfflat (embedding vector_cosine_ops) WITH (lists = ${lists});`
  await prisma.$executeRawUnsafe(sql)
  console.log('ANALYZE "DoubtKb";')
  await prisma.$executeRawUnsafe('ANALYZE "DoubtKb";')
}

async function attachEmbeddingsForIds(ids: string[], dim = DIM) {
  console.log('Attaching random embeddings for seeded rows...')
  for (const id of ids) {
    const v = randVec(dim)
    const lit = vecLiteral(v)
    await prisma.$executeRawUnsafe(
      `UPDATE "DoubtKb" SET embedding = $1::vector WHERE id = $2`,
      lit,
      id,
    )
  }
}

async function latencyTrial(ids: string[], trials = TRIALS, probes = 1) {
  console.log(`Running ${trials} trials (probes per trial: ${probes})`)
  let totalMs = 0
  let successes = 0
  for (let t = 0; t < trials; t++) {
    const idx = Math.floor(Math.random() * ids.length)
    const id = ids[idx]
    // fetch embedding for id
    const rows: any[] = await prisma.$queryRawUnsafe(`SELECT embedding FROM "DoubtKb" WHERE id = $1`, id)
    if (!rows || !rows.length) continue
    const emb = rows[0].embedding
    const start = Date.now()
    const res: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, 1 - (embedding <=> $1::vector) AS similarity FROM "DoubtKb" WHERE "subjectId" = $2 AND embedding IS NOT NULL ORDER BY similarity DESC LIMIT 1`,
      emb,
      SUBJECT_ID,
    )
    const ms = Date.now() - start
    totalMs += ms
    if (res && res.length && res[0].id === id) successes++
  }
  return { avgMs: totalMs / trials, recall: successes / trials }
}

async function main() {
  console.log('DoubtKb perf bench')
  const ids = await seed()
  await attachEmbeddingsForIds(ids)
  await ensureIvfflat()

  const probesToTry = [1, 2, 4]
  for (const p of probesToTry) {
    console.log(`\nSetting pgvector.ivfflat.probes = ${p}`)
    await prisma.$executeRawUnsafe(`SET pgvector.ivfflat.probes = ${p}`)
    const result = await latencyTrial(ids, Math.min(200, ids.length), p)
    console.log(`probes=${p} avgMs=${result.avgMs.toFixed(2)}ms recall=${(result.recall * 100).toFixed(2)}%`)
  }

  console.log('\nDone')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
