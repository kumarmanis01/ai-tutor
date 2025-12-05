// Minimal session user kept small to avoid bloating the auth token/session.
export interface SessionUser {
  id?: string;
  email?: string;
  name?: string;
  image?: string | null;
  role?: string;
}

// Full user object (DB-backed) used across the app for profile data.
export interface User {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  role?: string | null;
  parentEmail?: string | null;
  grade?: string | null; // stored as string for flexibility
  board?: string | null;
  phone?: string | null;
  country?: string | null;
  language?: string | null;
  subjects?: string[];
  plan?: string | null;
  billingCycle?: string | null;
  subscriptionEnd?: string | null;
  createdAt?: string | null;
}

// Backwards-compatible alias (optional).
export type UserProfile = User;
