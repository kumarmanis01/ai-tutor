import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  if (session?.user?.email !== "admin@yourdomain.com") {
    return <div className="p-6">Access denied</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <p>Here you can view metrics, logs, and manage subscriptions.</p>
    </div>
  );
}
