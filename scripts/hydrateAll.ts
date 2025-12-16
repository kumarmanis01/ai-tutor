import { hydrateNotes } from "@/hydrators/hydrateNotes"
import { hydrateQuestions } from "@/hydrators/hydrateQuestions"
import yargs from "yargs"
import { Arguments } from "yargs"
import { prisma } from "@/lib/prisma";

const { logger } = require('../lib/logger');

const argv = yargs(process.argv.slice(2))
  .option("fromTopic", { type: "string" })
  .parseSync() as Arguments<{ fromTopic?: string }>;

const topics = await prisma.topicDef.findMany({
  where: argv.fromTopic ? { id: { gte: argv.fromTopic } } : {}
})

for (const topic of topics) {
  try {
    await hydrateNotes(topic.id, "en")
    await hydrateNotes(topic.id, "hi")
    await hydrateQuestions(topic.id, "easy", "en")
    await hydrateQuestions(topic.id, "medium", "en")
    await hydrateQuestions(topic.id, "hard", "en")
    await hydrateQuestions(topic.id, "easy", "hi")
    await hydrateQuestions(topic.id, "medium", "hi")
    await hydrateQuestions(topic.id, "hard", "hi")
  } catch (e) {
    logger.error("FAILED at topic:", topic.id, e)
    process.exit(1)
  }
}
