import Image from 'next/image';

type LogoVariant = 'navbar' | 'navbar-mobile' | 'auth' | 'marketing';

interface LogoProps {
  variant: LogoVariant;
  className?: string;
}

export default function Logo({ variant, className }: LogoProps) {
  if (variant === 'navbar') {
    return (
      <div className={`flex items-center gap-2 ${className ?? ''}`}>
        <Image src="/logos/icon-192.png" alt="" width={28} height={28} priority className="rounded-md" />
        <span className="text-xl font-brand font-bold text-brand-orange leading-none">Spinzy Academy</span>
      </div>
    );
  }

  if (variant === 'navbar-mobile') {
    return (
      <div className={`flex items-center gap-1.5 ${className ?? ''}`}>
        <Image src="/logos/icon-192.png" alt="" width={22} height={22} priority className="rounded-md" />
        <span className="text-base font-brand font-bold text-brand-orange leading-none">Spinzy Academy</span>
      </div>
    );
  }

  if (variant === 'auth') {
    return (
      <div className={`flex flex-col items-center gap-2 ${className ?? ''}`}>
        <Image src="/logos/icon-192.png" alt="" width={52} height={52} priority className="rounded-xl" />
        <span className="text-2xl font-brand font-bold text-brand-orange" aria-label="Spinzy Academy">Spinzy Academy</span>
      </div>
    );
  }

  // marketing
  return (
    <Image
      src="/logos/logo-marketing.png"
      alt="Spinzy Academy"
      width={280}
      height={341}
      className={className}
    />
  );
}
