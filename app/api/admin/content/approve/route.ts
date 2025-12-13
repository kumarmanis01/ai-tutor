import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";



export async function POST(req: Request) {
  try {
    const { type, id } = await req.json();
    if (!type || !id || (type !== "note" && type !== "question")) {
      return NextResponse.json({ success: false, error: "Invalid type or id" }, { status: 400 });
    }

    // Use a type-safe switch for model selection
    switch (type) {
      case "chapter":
        return NextResponse.json({ success: false, error: "ChapterDef does not have a status field" }, { status: 400 });
      case "topic":
        return NextResponse.json({ success: false, error: "TopicDef does not have a status field" }, { status: 400 });
      case "note":
        await prisma.note.update({ where: { id }, data: {} });
        break;
      case "question":
        await prisma.question.update({ where: { id }, data: {} });
        break;
      default:
        return NextResponse.json({ success: false, error: "Invalid content type" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Content approval failed", { error });
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
