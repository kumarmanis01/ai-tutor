declare module 'next/server';
declare module 'next/navigation';
declare module 'next/headers';
declare module 'next/image';
declare module 'next/link';
declare module 'next/script';
declare module 'next/dynamic';
declare module 'next';

// Fallbacks for Next internals used in the project — these provide loose any-typed
// declarations so the TypeScript build can proceed while we incrementally add
// precise types if needed.
interface NextModuleAny {
  [key: string]: any;
}

declare const Next: NextModuleAny;
export default Next;
