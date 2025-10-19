import RoomClient from '@/components/RoomClient';

export default function Page({ params }: { params: { roomId: string } }) {
  return <RoomClient roomId={params.roomId} />;
}
