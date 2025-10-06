export interface SessionUser {
  id?: string;
  email?: string;
  name?: string;
  image?: string;
  role?: string;
  parentEmail?: string;
  grade?: string;
  password?: string; // Optional, not used for auth here
  // Add other custom fields if needed
}

export interface Payment {
  id: string;
  user?: { email?: string };
  amount: number;
  provider?: string;
  createdAt: string;
}
