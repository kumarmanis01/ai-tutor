import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return <div className="p-6">You are not signed in.</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Profile</h1>
      <p>
        <strong>Name:</strong> {session.user?.name}
      </p>
      <p>
        <strong>Email:</strong> {session.user?.email}
      </p>
      {session.user?.image && (
        <img
          src={session.user.image}
          alt="avatar"
          className="w-20 h-20 rounded-full"
        />
      )}
    </div>
  );
}
