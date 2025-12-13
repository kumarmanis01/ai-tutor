import { Worker } from "bullmq"
import IORedis from "ioredis"
import { hydrateNotes } from "../hydrators/hydrateNotes"
import { hydrateQuestions } from "../hydrators/hydrateQuestions"
import { assembleTest } from "../hydrators/assembleTest"

const connection = new IORedis(process.env.REDIS_URL!)

new Worker(
  "content-hydration",
  async job => {
    const { type, payload } = job.data

    switch (type) {
      case "NOTES":
        return hydrateNotes(payload.topicId, payload.language)

      case "QUESTIONS":
        return hydrateQuestions(payload.topicId, payload.difficulty)

      case "ASSEMBLE_TEST":
        return assembleTest(payload.topicId)

      default:
        throw new Error("Unknown job type")
    }
  },
  { connection, concurrency: 3 }
)
