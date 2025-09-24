// app/rooms/page.tsx
import RoomList from "@/components/Rooms/RoomList";

export default function RoomsIndex() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Study Rooms</h1>
      <RoomList />
    </main>
  );
}
