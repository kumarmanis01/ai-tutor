import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    // Example: generate explanation text
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Explain clearly with diagrams if useful." },
        { role: "user", content: query },
      ],
    });

    const text = completion.choices[0].message?.content;

    // Example: optional diagram (generate image)
    const img = await openai.images.generate({
      model: "gpt-image-1",
      prompt: `Diagram for: ${query}`,
      size: "512x512",
    });

    return NextResponse.json({ text, image: img.data[0].url });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "ai_explain_failed" }, { status: 500 });
  }
}
