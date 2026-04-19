/**
 * FILE OBJECTIVE:
 * - CLI script to insert a MarketingSpend record for CAC calculations.
 *
 * LINKED UNIT TEST:
 * - tests/unit/scripts/insert-marketing-spend.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-17T00:00:00Z | senior-engineer | add marketing spend CLI
 */

import { z } from 'zod'
import { PrismaClient } from '@prisma/client'

const argv = process.argv.slice(2)

const ArgSchema = z.object({
  start: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'invalid start date' }),
  end: z.string().refine((v) => !isNaN(Date.parse(v)), { message: 'invalid end date' }),
  amount: z.number().int().positive(),
  channel: z.string().optional(),
  currency: z.string().optional().default('INR'),
  notes: z.string().optional(),
  createdBy: z.string().optional(),
})

function parseArgs(argv: string[]) {
  const out: any = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const k = a.slice(2)
      const v = argv[i + 1]
      if (v && !v.startsWith('--')) {
        out[k] = v
        i++
      } else {
        out[k] = true
      }
    }
  }
  // coerce amount
  if (out.amount) out.amount = Number(out.amount)
  return out
}

async function main() {
  const raw = parseArgs(argv)
  const parsed = ArgSchema.safeParse(raw)
  if (!parsed.success) {
    console.error('Invalid args', parsed.error.format())
    console.error('Usage: node -r ts-node/register scripts/insert-marketing-spend.ts --start 2026-04-01 --end 2026-04-30 --amount 500000 --channel google --notes "April campaign" --createdBy adminId')
    process.exit(2)
  }

  const prisma = new PrismaClient()
  try {
    const rec = await prisma.marketingSpend.create({ data: {
      periodStart: new Date(parsed.data.start),
      periodEnd: new Date(parsed.data.end),
      amount: parsed.data.amount,
      channel: parsed.data.channel ?? null,
      currency: parsed.data.currency ?? 'INR',
      notes: parsed.data.notes ?? null,
      createdBy: parsed.data.createdBy ?? null,
    } })
    console.log('created', rec.id)
    process.exit(0)
  } catch (err: any) {
    console.error('failed to create marketing spend', err && err.message ? err.message : err)
    process.exit(3)
  } finally {
    try { await prisma.$disconnect() } catch {}
  }
}

if (require.main === module) {
  void main()
}
