import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

// NextAuth types can be flaky across versions; cast to any to satisfy TS.
const handler: any = (NextAuth as any)(authOptions as any);
export { handler as GET, handler as POST };
