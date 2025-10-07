export interface SessionUser {
  id?: string;
  email?: string;
  name?: string;
  image?: string | null;
  role?: string;
  parentEmail?: string | null;
  grade?: string | null;
  password?: string; // Optional, not used for auth here
  country?: string | null;
  // Add other custom fields if needed
}
