// app/api/rooms/route.ts
import { NextResponse } from "next/server";
import * as roomService from "@/lib/roomService";

export async function GET() {
  try {
    const rooms = await roomService.listRooms();
    return NextResponse.json({ rooms });
  } catch (err) {
    console.error("rooms GET", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, description, isPrivate } = body;
    if (!name)
      return NextResponse.json({ error: "name_required" }, { status: 400 });

    const room = await roomService.createRoom({ name, description, isPrivate });
    return NextResponse.json({ room });
  } catch (err) {
    console.error("rooms POST", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
