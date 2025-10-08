import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string;
      parentEmail?: string | null;
      grade?: string | null;
      country?: string | null;
      plan?: string | null;
      billingCycle?: string | null;
      language?: string | null;
      createdAt?: string | null;
    };
  }
}
