export interface SessionUser {
  id?: string;
  email?: string;
  name?: string;
  image?: string | null;
  role?: string;
  parentEmail?: string | null;
  grade?: string | null;
  password?: string;
  country?: string | null;
  plan?: string | null;
  billingCycle?: string | null;
  language?: string | null;
  createdAt?: string | null;
}
