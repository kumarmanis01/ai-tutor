import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertNoStringFilters } from "@/lib/guards/noStringFilters";
import { logger } from "@/lib/logger";
import { getRedis } from "@/lib/redis";

const BOARDS_CACHE_KEY = 'boards:all-with-classes';
const BOARDS_CACHE_TTL_SEC = 3600;

// GET all boards
export async function GET(req: Request) {
  try {
    try {
      assertNoStringFilters(req);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
    }

    const redis = getRedis?.();
    if (redis) {
      try {
        const cached = await redis.get(BOARDS_CACHE_KEY);
        if (cached) {
          return new NextResponse(cached, {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
      } catch (cacheErr) {
        logger.warn('GET /api/boards cache read failed', { err: String(cacheErr) });
      }
    }

    const boards = await prisma.board.findMany({ include: { classes: true } });
    const payload = JSON.stringify(boards);
    if (redis) {
      try {
        await redis.set(BOARDS_CACHE_KEY, payload, 'EX', BOARDS_CACHE_TTL_SEC);
      } catch (cacheErr) {
        logger.warn('GET /api/boards cache write failed', { err: String(cacheErr) });
      }
    }
    return new NextResponse(payload, {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    logger.error('GET /api/boards error', { err });
    return new NextResponse(JSON.stringify({ error: 'Service temporarily unavailable' }), { status: 503 });
  }
}

// CREATE a board
export async function POST(req: Request) {
  try {
    const data = await req.json();
    const board = await prisma.board.create({ data });
    // Invalidate the cache so the new board appears on the next GET.
    const redis = getRedis?.();
    if (redis) {
      try {
        await redis.del(BOARDS_CACHE_KEY);
      } catch (cacheErr) {
        // Staleness here is user-visible (new board missing until TTL expiry),
        // so surface it for operational diagnosis rather than swallowing.
        logger.warn('POST /api/boards cache invalidation failed', { err: String(cacheErr) });
      }
    }
    return NextResponse.json(board);
  } catch (err) {
    logger.error('POST /api/boards error', { err });
    return new NextResponse(JSON.stringify({ error: 'Service temporarily unavailable' }), { status: 503 });
  }
}
