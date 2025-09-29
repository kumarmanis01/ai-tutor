// lib/roomService.ts
import { prisma } from "./db";
import { publish } from "./realtime";
import fetch from "node-fetch";

/**
 * Room service - single responsibility functions.
 * - Keeps DB logic in one place, used by API routes.
 */

export async function createRoom({
  name,
  description,
  createdBy,
  isPrivate = false,
}: {
  name: string;
  description?: string;
  createdBy?: string;
  isPrivate?: boolean;
}) {
  return prisma.room.create({
    data: { name, description, createdBy, isPrivate },
  });
}

export async function listRooms() {
  return prisma.room.findMany({ orderBy: { updatedAt: "desc" }, take: 50 });
}

export async function getLastMessages(roomId: string, limit = 50) {
  return prisma.message.findMany({
    where: { roomId },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

export async function postMessage(
  roomId: string,
  {
    senderId,
    sender,
    role,
    content,
    aiMeta,
  }: {
    senderId?: string;
    sender?: string;
    role: string;
    content: string;
    aiMeta?: any;
  },
) {
  // persist
  const m = await prisma.message.create({
    data: {
      roomId,
      senderId,
      sender,
      role,
      content,
      aiMeta: aiMeta ?? {},
    },
  });

  // publish to active subscribers for realtime UI
  publish(roomId, { type: "message", payload: m });

  // optionally: trigger AI facilitator if config says so
  if (role === "user") {
    // Example rule: if message contains "help me" or the room has facilitator enabled (extend)
    const shouldAiReply = /help|explain|stuck|how do/i.test(content);
    if (shouldAiReply) {
      startAiFacilitator(roomId, content);
    }
  }

  return m;
}

async function startAiFacilitator(roomId: string, userMessage: string) {
  try {
    // Build prompt — keep simple & replaceable
    const system =
      "You are an AI study facilitator. Provide a short, friendly reply that helps the student and invites collaboration. Keep under 120 words.";
    const messages = [
      { role: "system", content: system },
      { role: "user", content: userMessage },
    ];

    // call OpenAI Chat Completion server-side (server key required)
    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_KEY) return;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages,
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (reply) {
      const aiMsg = await prisma.message.create({
        data: {
          roomId,
          role: "assistant",
          sender: "AI Facilitator",
          content: reply,
          aiMeta: { source: "facilitator" },
        },
      });
      publish(roomId, { type: "message", payload: aiMsg });
    }
  } catch (err) {
    console.error("AI facilitator error:", err);
  }
}

/*
Notes:
startAiFacilitator is intentionally lightweight. You can swap it with a more advanced pipeline later (context memory, subject prompts).


You can control facilitator behavior using room settings (add a boolean in Room model like aiFacilitator).

*/
