import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logger } from '@/lib/logger';

// NextAuth types can be flaky across versions; cast to any to satisfy TS.
const handler: any = (NextAuth as any)(authOptions as any);

export const GET = async (...args: any[]) => {
	const start = Date.now();
	try {
		const res = await handler(...args);
		logger.add('nextauth.request', { className: 'auth', methodName: 'nextauth.GET', durationMs: Date.now() - start });
		return res;
	} catch (err) {
		logger.error('nextauth.GET handler error', { className: 'auth', methodName: 'nextauth.GET', error: String(err) });
		throw err;
	}
};

export const POST = async (...args: any[]) => {
	const start = Date.now();
	try {
		const res = await handler(...args);
		logger.add('nextauth.request', { className: 'auth', methodName: 'nextauth.POST', durationMs: Date.now() - start });
		return res;
	} catch (err) {
		logger.error('nextauth.POST handler error', { className: 'auth', methodName: 'nextauth.POST', error: String(err) });
		throw err;
	}
};
