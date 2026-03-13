import { redirect } from 'next/navigation';

// Modal-only UX: always send students back to the dashboard. The ParentOTPGate
// component is responsible for showing the OTP flow as a modal over /dashboard
// when requiresParentOTPGate() returns true.
export default function VerifyParentPage() {
  redirect('/dashboard');
}
