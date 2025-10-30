import RoomClient from '@/components/RoomClient';
import ProfileWidgets from '@/components/ProfileWidgets';

export default function Page({ params }: { params: { roomId: string } }) {
  const { roomId } = params;

  return (
    <div className="flex gap-6">
      <main className="flex-1">
        {/* ...existing main/room UI... */}
        <RoomClient roomId={roomId} />
      </main>

      <aside className="w-80 space-y-4">
        {/* show only invite + leaderboard */}
        <ProfileWidgets showLeaderboard={true} showChallenge={false} />
      </aside>
    </div>
  );
}
