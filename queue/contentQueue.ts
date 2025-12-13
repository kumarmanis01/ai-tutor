import { Queue } from "bullmq"
import IORedis from "ioredis"

const connection = new IORedis(process.env.REDIS_URL!)

export const contentQueue = new Queue("content-hydration", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: true,
    removeOnFail: false
  }
})
