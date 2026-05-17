import { ReactNode } from 'react';

interface KVProps {
  label: string;
  value: ReactNode;
  emptyHint?: string;
  /** When true, omits bottom divider -- use on the last row of a list. */
  last?: boolean;
}

function isEmpty(v: ReactNode): boolean {
  return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
}

/** Definition-list row: label (muted xs) + value (sm foreground). */
export function KV({ label, value, emptyHint = 'Not set', last = false }: KVProps) {
  const empty = isEmpty(value);
  return (
    <div
      className={[
        'grid grid-cols-[120px_1fr] gap-3.5 py-3',
        last ? '' : 'border-b border-border/50',
      ].filter(Boolean).join(' ')}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">
        {empty
          ? <span className="italic text-ink-4">{emptyHint}</span>
          : value}
      </span>
    </div>
  );
}
