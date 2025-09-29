// app/api/rooms/[id]/messages/route.ts
import { NextResponse } from "next/server";
import * as roomService from "@/lib/roomService";

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    const messages = await roomService.getLastMessages(id, 200);
    return NextResponse.json({ messages });
  } catch (err) {
    console.error("messages GET", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    const body = await req.json();
    const { senderId, sender, role = "user", content } = body;
    if (!content)
      return NextResponse.json({ error: "content_required" }, { status: 400 });

    const m = await roomService.postMessage(id, {
      senderId,
      sender,
      role,
      content,
    });
    return NextResponse.json({ message: m });
  } catch (err) {
    console.error("messages POST", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
