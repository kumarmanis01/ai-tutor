import { getServerSessionForHandlers } from '@/lib/session';
import { SessionUser } from '@/lib/types';
import { redirect } from 'next/navigation';

export default async function AdminPage() {
  const session = await getServerSessionForHandlers();
  if (!session) {
    // Redirect to sign-in page if not authenticated
    // redirect('/api/auth/signin');
    redirect('/'); //redirect to root for sign-in
  }

  const sessionUser = session.user as SessionUser;

  if (sessionUser.email !== 'admin@yourdomain.com') {
    return <div className="p-6">Access denied</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <p>Here you can view metrics, logs, and manage subscriptions.</p>
    </div>
  );
}
