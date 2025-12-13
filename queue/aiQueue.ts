import { Queue } from "bullmq";

export const aiQueue = new Queue("ai-hydration", {
  connection: { host: "localhost", port: 6379 },
});
