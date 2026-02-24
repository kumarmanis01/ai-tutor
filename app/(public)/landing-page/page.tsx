import { redirect } from 'next/navigation';

// Alias route: keep for backward-compatibility, redirect to root
export default function LandingPageAlias() {
  redirect('/');
}
