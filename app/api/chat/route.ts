// app/api/chat/route.ts
import { NextResponse } from "next/server";

/**
 * Chat server route (safe: OpenAI key on server)
 * Accepts either:
 *  - { message: string, language?: string }
 *  - { messages: [{ role, content }], language?: string }
 *
 * Returns { reply: string }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_KEY) return NextResponse.json({ error: "openai_key_missing" }, { status: 500 });

    // Build final conversation
    const language = typeof body.language === "string" ? body.language : "English";
    const systemPrompt =
      (language || "").toLowerCase().startsWith("hi")
        ? "आप एक सहायक AI ट्यूटर हैं। उपयोगकर्ता के प्रश्नों का उत्तर हिंदी में दें।"
        : "You are a helpful AI tutor. Answer the user's questions in English.";

    const messages = [{ role: "system", content: systemPrompt }];

    if (Array.isArray(body.messages)) {
      for (const m of body.messages) {
        messages.push({ role: m.role, content: m.content });
      }
    } else if (typeof body.message === "string") {
      messages.push({ role: "user", content: body.message });
    } else {
      return NextResponse.json({ error: "no_message" }, { status: 400 });
    }

    const payload = {
      model: "gpt-3.5-turbo",
      messages,
      temperature: 0.6,
      max_tokens: 800,
    };

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const txt = await r.text();
      console.error("OpenAI error", r.status, txt);
      return NextResponse.json({ error: "openai_error", detail: txt }, { status: 502 });
    }

    const data = await r.json();
    const reply = data?.choices?.[0]?.message?.content ?? "";

    return NextResponse.json({ reply });
  } catch (err: any) {
    console.error("chat route error:", err);
    return NextResponse.json({ error: "server_error", detail: String(err) }, { status: 500 });
  }
}
