import { Queue } from 'bullmq';
import { getSharedConnection } from '../../lib/redis.js';

let _contentQueue: Queue | null = null;

export function getContentQueue() {
  if (_contentQueue) return _contentQueue;
  _contentQueue = new Queue('content-queue', {
    connection: getSharedConnection(),
  });
  return _contentQueue;
}
