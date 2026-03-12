/**
 * Parent verification — under-18 students must have a parent verify via OTP.
 * Reached via layout redirect when checkParentGate returns required && !verified.
 * Single screen: masked parent email, Send OTP, 6-digit input, redirect to dashboard on success.
 */
import { requireActiveSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { checkParentGate } from '@/lib/student/parentGate';
import VerifyParentForm from './VerifyParentForm';

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***';
  const [local, domain] = email.split('@');
  const masked =
    local.length <= 2 ? '***' : local[0] + '***' + local[local.length - 1];
  return `${masked}@${domain}`;
}

export default async function VerifyParentPage() {
  const session = await requireActiveSession();
  if (!session) redirect('/');

  const userId = (session.user as { id?: string })?.id;
  if (!userId) redirect('/');

  const gate = await checkParentGate(userId);
  if (!gate.required || gate.verified) {
    redirect('/student/dashboard');
  }

  const maskedEmail = gate.parentEmail ? maskEmail(gate.parentEmail) : '***';
  if (!gate.parentEmail?.trim()) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Parent verification</h1>
        <p className="mt-2 text-gray-600">
          Your parent needs to verify your account, but no parent email is set.
          Please complete your profile and add a parent email, then return here.
        </p>
        <a
          href="/student/onboarding"
          className="mt-4 inline-block text-primary underline"
        >
          Go to profile
        </a>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">
        Your parent needs to verify your account
      </h1>
      <VerifyParentForm maskedEmail={maskedEmail} />
    </div>
  );
}
