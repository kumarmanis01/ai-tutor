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
  age?: number | null;
  parentPhone?: string | null;
  parentPhoneVerifiedAt?: string | null;
  accountStatus?: string | null;
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
  userBadges?: Array<{
    id: string;
    badgeKey: string;
    earnedAt?: string;
    badge?: { name?: string | null; description?: string | null; icon?: string | null } | null;
  }>;
  schoolName?: string | null;
  learningStyle?: string | null;
  /** Daily learning streak count */
  currentStreak?: number;
  /** All-time longest streak ever achieved */
  longestStreak?: number;
  /** Keys of cosmetic items unlocked via streak milestones */
  cosmeticUnlocks?: string[];
  /** Optional persisted user preferences (UI & accessibility) */
  preferences?: {
    crunchMode?: 'auto' | 'on' | 'off';
    fontSize?: 'small' | 'medium' | 'large';
    badgeShowcase?: string[];
  } | null;
}

// Backwards-compatible alias (optional).
export type UserProfile = User;
