// invalid.js — creates Redis and Queue at module scope (should trigger rule)
import IORedis from 'ioredis';
import { Queue } from 'bullmq';

const redis = new IORedis('redis://localhost:6379');
const q = new Queue('content', { connection: redis });

export function noop() { return 1 }
