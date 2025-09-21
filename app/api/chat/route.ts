// app/api/chat/route.ts
import { NextResponse } from "next/server";

/**
 * Server-side chat route
 * - Accepts POST { message: string, language?: string }
 * - Forwards to OpenAI Chat Completions
 * - Returns { reply: string }
 *
 * Important: put OPENAI_API_KEY in .env.local as OPENAI_API_KEY
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const language = typeof body?.language === "string" ? body.language : "English";

    if (!message) {
      return NextResponse.json({ error: "message_required" }, { status: 400 });
    }

    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_KEY) {
      console.error("Missing OPENAI_API_KEY env var");
      return NextResponse.json({ error: "openai_key_missing" }, { status: 500 });
    }

    // System prompt enforces the language in which the model should reply.
    const systemPrompt =
      language.toLowerCase().startsWith("hi") || language.toLowerCase().includes("hindi")
        ? "आप एक सहायक AI ट्यूटर हैं। उपयोगकर्ता के प्रश्नों का उत्तर हिंदी में दें। सरल, स्पष्ट और छात्र-उपयोगी भाषा में उत्तर दें।"
        : "You are a helpful AI tutor. Answer the user's questions in English. Keep explanations simple and suitable for school students.";

    const payload = {
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      temperature: 0.6,
      max_tokens: 800,
    };

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const txt = await r.text();
      console.error("OpenAI error:", r.status, txt);
      return NextResponse.json({ error: "openai_error", detail: txt }, { status: 502 });
    }

    const data = await r.json();
    const reply = data?.choices?.[0]?.message?.content ?? "";

    return NextResponse.json({ reply });
  } catch (err: any) {
    console.error("Chat route error:", err);
    return NextResponse.json({ error: "server_error", detail: String(err) }, { status: 500 });
  }
}
