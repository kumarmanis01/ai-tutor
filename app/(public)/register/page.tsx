import { redirect } from 'next/navigation';

// Registration goes through the standard auth flow.
// After sign-in, new users land on /student/onboarding which runs ProfileCompletionGate.
export default function RegisterPage() {
  redirect('/auth/signin?callbackUrl=/student/onboarding');
}
