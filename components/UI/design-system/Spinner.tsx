const SIZE_CLASSES = {
  sm: 'w-5 h-5 border-2',
  md: 'w-8 h-8 border-2',
  lg: 'w-12 h-12 border-[3px]',
} as const;

interface SpinnerProps {
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <div
      className={[
        SIZE_CLASSES[size],
        'border-primary border-t-transparent rounded-full animate-spin',
        className,
      ].join(' ')}
      role="status"
      aria-label="Loading"
    />
  );
}
