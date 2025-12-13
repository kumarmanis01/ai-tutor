import { hydrateNotes } from "@/hydrators/hydrateNotes"
import { hydrateQuestions } from "@/hydrators/hydrateQuestions"
import yargs from "yargs"
import { prisma } from "@/lib/prisma";

const argv = yargs(process.argv.slice(2))
  .option("fromTopic", { type: "string" })
  .parse()

const topics = await prisma.topicDef.findMany({
  where: argv.fromTopic ? { id: { gte: argv.fromTopic } } : {}
})

for (const topic of topics) {
  try {
    await hydrateNotes(topic.id, "en")
    await hydrateNotes(topic.id, "hi")
    await hydrateQuestions(topic.id, "easy")
    await hydrateQuestions(topic.id, "medium")
    await hydrateQuestions(topic.id, "hard")
  } catch (e) {
    console.error("FAILED at topic:", topic.id, e)
    process.exit(1)
  }
}
