// components/Rooms/RoomList.tsx
"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";

type Room = { id: string; name: string; description?: string };

export default function RoomList() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  useEffect(() => {
    fetchRooms();
  }, []);

  async function fetchRooms() {
    const res = await fetch("/api/rooms");
    const data = await res.json();
    setRooms(data.rooms ?? []);
  }

  async function createRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: desc }),
    });
    const data = await res.json();
    setName("");
    setDesc("");
    fetchRooms();
    // redirect to new room optionally
    if (data.room?.id) {
      window.location.href = `/rooms/${data.room.id}`;
    }
  }

  return (
    <div>
      <form onSubmit={createRoom} className="mb-4 flex gap-2">
        <input
          value={name}
          placeholder="Room name"
          onChange={(e) => setName(e.target.value)}
          className="border p-2 rounded flex-1"
        />
        <button className="px-3 py-2 bg-blue-600 text-white rounded">
          Create
        </button>
      </form>

      <ul className="space-y-2">
        {rooms.map((r) => (
          <li key={r.id} className="p-3 border rounded hover:shadow">
            <Link href={`/rooms/${r.id}`} className="block">
              <div className="font-medium">{r.name}</div>
              <div className="text-sm text-gray-500">{r.description}</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
