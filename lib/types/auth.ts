export type AppUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string | null;
  parentEmail?: string | null;
  grade?: string | null;
  country?: string | null;
  plan?: string | null;
  billingCycle?: string | null;
  language?: string | null;
  createdAt?: string | null;
}

export type AppSession = {
  user: AppUser;
  // allow extra fields (jwt, etc.)
  [key: string]: any;
}
