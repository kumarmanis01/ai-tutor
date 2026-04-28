/**
 * FILE OBJECTIVE:
 * - Reusable Coming Soon page shell for routes that are planned but not yet live.
 *   Used by /blog, /careers, /press, /dpdp, /cookies.
 */

import Link from 'next/link';

interface ComingSoonProps {
  title: string;
  description: string;
  backLabel?: string;
  backHref?: string;
}

export default function ComingSoon({
  title,
  description,
  backLabel = 'Back to Home',
  backHref = '/',
}: ComingSoonProps) {
  return (
    <main className="flex min-h-[calc(100vh-72px)] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mx-auto max-w-md">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EEEDFE] text-4xl">
          🚧
        </div>
        <h1 className="mb-3 font-headline text-3xl font-bold text-secondary md:text-4xl">
          {title}
        </h1>
        <p className="mb-2 font-accent text-lg text-[#534AB7]">जल्द आ रहा है</p>
        <p className="mb-8 font-body text-base leading-relaxed text-muted-foreground">
          {description}
        </p>
        <Link
          href={backHref}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#534AB7] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#433ba0]"
        >
          {backLabel}
        </Link>
        <p className="mt-6 text-xs text-muted-foreground">
          Questions?{' '}
          <a
            href="mailto:hello@spinzyacademy.com"
            className="text-[#534AB7] hover:underline"
          >
            hello@spinzyacademy.com
          </a>
        </p>
      </div>
    </main>
  );
}
