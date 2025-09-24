// app/api/rooms/[id]/stream/route.ts
import { NextResponse } from "next/server";
import { subscribe } from "@/lib/realtime";

/**
 * SSE stream endpoint for room messages
 * Client: new EventSource(`/api/rooms/${id}/stream`)
 * Server publishes JSON events: { type: "message", payload: { ... } }
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // send a comment to keep connection alive initially
      controller.enqueue(encoder.encode(":\n\n"));

      const push = (data: any) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
          console.error("SSE enqueue error", e);
        }
      };

      const unsubscribe = subscribe(id, (payload) => {
        push(payload);
      });

      // ping every 30s to keep the connection alive in some proxies
      const keepAlive = setInterval(() => controller.enqueue(encoder.encode(":\n\n")), 30000);

      // cleanup on cancel
      controller.oncancel = () => {
        clearInterval(keepAlive);
        unsubscribe();
      };
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

/**
Important: SSE works well for browser clients. If you need full duplex (server→client and client→server real-time), use WebSockets. This design keeps writes as HTTP POSTs (easy to scale behind load balancers) and reads as SSE.

**/