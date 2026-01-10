import { Queue } from "bullmq";
import { redisConnection } from "@/lib/redis";

export const contentQueue = new Queue("content-queue", {
  connection: redisConnection,
});
