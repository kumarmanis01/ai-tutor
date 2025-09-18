// app/api/chat/route.ts
import { NextResponse } from "next/server";

type ReqBody = { message?: string; language?: string };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReqBody;
    const message = body?.message?.trim();
    const language = body?.language || "English";

    if (!message) {
      return NextResponse.json({ error: "message_required" }, { status: 400 });
    }

    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_KEY) {
      return NextResponse.json({ error: "openai_key_missing" }, { status: 500 });
    }

    const payload = {
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a helpful AI tutor. ALWAYS reply in ${language}. Keep responses simple and clear for school students.`
        },
        { role: "user", content: message }
      ],
      temperature: 0.6,
      max_tokens: 800
    };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!data || !data.choices || !data.choices[0] || !data.choices[0].message) {
      return NextResponse.json(
        { error: "no_content_from_openai" },
        { status: 500 }
      );
    }

    const reply = data.choices[0].message.content || "";

    return NextResponse.json({ reply });
  } catch (err: any) {
    console.error("API /api/chat error:", err);
    return NextResponse.json({ error: "server_error", detail: String(err) }, { status: 500 });
  }
}
