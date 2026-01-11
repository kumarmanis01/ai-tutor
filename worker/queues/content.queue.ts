import { Queue } from "bullmq";

let _contentQueue: Queue | null = null;

export function getContentQueue() {
  if (_contentQueue) return _contentQueue
  _contentQueue = new Queue('content-queue', {
    connection: { url: process.env.REDIS_URL! },
  })
  return _contentQueue
}
