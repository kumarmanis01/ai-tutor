import { Queue } from "bullmq";

export const contentQueue = new Queue("content-queue", {
  connection: {
    url: process.env.REDIS_URL!,
  },
});
