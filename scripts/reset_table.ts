/**
 * Safe reset script for selected Prisma models.
 *
 * Usage (dry-run):
 *   npx ts-node scripts/reset_table.ts --model=TopicDef --chapterId=CHAP_ID --dry-run
 *
 * Apply (soft-delete):
 *   npx ts-node scripts/reset_table.ts --model=TopicDef --chapterId=CHAP_ID
 *
 * Hard delete (dangerous — requires --force):
 *   npx ts-node scripts/reset_table.ts --model=TopicDef --chapterId=CHAP_ID --mode=hard --force
 *
 * Rules:
 * - Defaults to a safe soft-delete (sets lifecycle = deleted).
 * - Always supports --dry-run to preview affected rows.
 * - Writes a single AuditLog entry summarizing the action.
 */

import { prisma } from "@/lib/prisma"
import { SoftDeleteStatus } from "@prisma/client"

type Options = {
  model?: string
  mode?: "soft" | "hard"
  dryRun?: boolean
  force?: boolean
  where?: Record<string, any>
}

function parseArgs(): Options {
  const raw = process.argv.slice(2)
  const out: any = { mode: "soft", dryRun: false, force: false, where: {} }
  for (const a of raw) {
    if (!a.startsWith("--")) continue
    const arg = a.slice(2)
    const [k, v] = arg.split("=")
    if (v === undefined) {
      // flags
      if (k === "dry-run" || k === "dryRun") out.dryRun = true
      if (k === "force") out.force = true
      continue
    }
    if (k === "model") out.model = v
    else if (k === "mode") out.mode = v
    else if (k === "where") {
      try { out.where = JSON.parse(v) } catch { out.where = {} }
    } else {
      // treat as simple filter key
      out.where[k] = isNaN(Number(v)) ? v : Number(v)
    }
  }
  return out
}

async function main() {
  const opts = parseArgs()
  if (!opts.model) {
    console.error("--model is required. Example: --model=TopicDef")
    process.exit(1)
  }

  const allowed = [
    "TopicDef",
    "TopicNote",
    "GeneratedTest",
    "GeneratedQuestion",
    "ChapterDef"
  ]
  if (!allowed.includes(opts.model)) {
    console.error(`Model '${opts.model}' is not in allowed list: ${allowed.join(", ")}`)
    process.exit(1)
  }

  const delegate = opts.model.charAt(0).toLowerCase() + opts.model.slice(1)
  const client: any = (prisma as any)[delegate]
  if (!client) {
    console.error(`Prisma client delegate not found for ${delegate}`)
    process.exit(1)
  }

  const where = opts.where && Object.keys(opts.where).length ? opts.where : {}

  const count: number = await client.count({ where })
  console.log(`Target model: ${opts.model}`)
  console.log(`Filter: ${JSON.stringify(where) || "<none>"}`)
  console.log(`Matched rows: ${count}`)

  if (count === 0) {
    console.log("Nothing to do.")
    process.exit(0)
  }

  if (opts.dryRun) {
    const sample = await client.findMany({ where, select: { id: true }, take: 20 })
    console.log("Dry run — sample ids:", sample.map((s: any) => s.id))
    process.exit(0)
  }

  if (opts.mode === "hard" && !opts.force) {
    console.error("Hard delete requested — add --force to confirm. Prefer soft deletes.")
    process.exit(1)
  }

  if (opts.mode === "soft") {
    // Soft-delete: set lifecycle = deleted (if model has lifecycle field)
    try {
      const res = await client.updateMany({ where, data: { lifecycle: SoftDeleteStatus.deleted } })
      await prisma.auditLog.create({
        data: {
          action: `soft-delete:${opts.model}`,
          details: { count: res.count, filter: where }
        }
      })
      console.log(`Soft-deleted ${res.count} ${opts.model} rows.`)
    } catch (err: any) {
      console.error("Failed to soft-delete:", err.message || err)
      process.exit(1)
    }
  } else {
    // Hard delete
    try {
      const res = await client.deleteMany({ where })
      await prisma.auditLog.create({
        data: {
          action: `hard-delete:${opts.model}`,
          details: { count: res.count, filter: where }
        }
      })
      console.log(`Hard-deleted ${res.count} ${opts.model} rows.`)
    } catch (err: any) {
      console.error("Failed to hard-delete:", err.message || err)
      process.exit(1)
    }
  }

  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
