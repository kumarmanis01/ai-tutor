import { redirect } from 'next/navigation';

// /auth/signup is not a separate page -- new students register at /register.
// Returning users (and parent onboarding) use /auth/signin.
// This redirect preserves any existing bookmarks or external links.
export default function SignupRedirectPage() {
  redirect('/register');
}
