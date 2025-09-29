// app/rooms/[id]/page.tsx (server component wrapper)
import RoomPage from "@/components/Rooms/RoomPage";

export default function RoomRoute({ params }: { params: { id: string } }) {
  const { id } = params;
  return (
    <div className="p-6">
      <RoomPage roomId={id} />
    </div>
  );
}
