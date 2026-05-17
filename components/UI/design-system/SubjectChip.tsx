import type { CSSProperties } from 'react';

export type SubjectId =
  | 'mathematics'
  | 'physics'
  | 'chemistry'
  | 'biology'
  | 'science'
  | 'english'
  | 'social'
  | 'hindi';

interface SubjectMeta {
  short: string;
  name: string;
  textClass: string;
  bgClass: string;
}

const SUBJECT_META: Record<SubjectId, SubjectMeta> = {
  mathematics: { short: 'Math',    name: 'Mathematics',    textClass: 'text-subject-mathematics', bgClass: 'bg-subject-mathematics-bg' },
  physics:     { short: 'Physics', name: 'Physics',        textClass: 'text-subject-physics',     bgClass: 'bg-subject-physics-bg' },
  chemistry:   { short: 'Chem',    name: 'Chemistry',      textClass: 'text-subject-chemistry',   bgClass: 'bg-subject-chemistry-bg' },
  biology:     { short: 'Bio',     name: 'Biology',        textClass: 'text-subject-biology',     bgClass: 'bg-subject-biology-bg' },
  science:     { short: 'Science', name: 'Science',        textClass: 'text-subject-physics',     bgClass: 'bg-subject-physics-bg' },
  english:     { short: 'English', name: 'English',        textClass: 'text-subject-english',     bgClass: 'bg-subject-english-bg' },
  social:      { short: 'Social',  name: 'Social Studies', textClass: 'text-subject-social',      bgClass: 'bg-subject-social-bg' },
  hindi:       { short: 'Hindi',   name: 'Hindi',          textClass: 'text-subject-hindi',       bgClass: 'bg-subject-hindi-bg' },
};

export function subjectMeta(id: SubjectId): SubjectMeta {
  return SUBJECT_META[id];
}

/** Inline pill with colored glyph square + subject short name. */
export function SubjectChip({ subjectId, size = 'xs' }: { subjectId: SubjectId; size?: 'xs' | 'sm' }) {
  const m = SUBJECT_META[subjectId];
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 pl-1 pr-2.5 py-0.5 rounded-full',
        size === 'sm' ? 'text-sm' : 'text-xs',
        'font-medium leading-tight',
        m.bgClass,
        m.textClass,
      ].join(' ')}
    >
      <span
        aria-hidden
        className={[
          'inline-flex items-center justify-center w-4 h-4 rounded',
          'text-[9px] font-serif text-white',
          m.textClass.replace('text-subject', 'bg-subject'),
        ].join(' ')}
      >
        {m.short[0]}
      </span>
      {m.short}
    </span>
  );
}

/** Square subject identity tile (no label). Inline style for dynamic pixel size is intentional. */
export function SubjectGlyph({ subjectId, size = 36 }: { subjectId: SubjectId; size?: number }) {
  const m = SUBJECT_META[subjectId];
  const style: CSSProperties = { width: size, height: size, fontSize: Math.round(size * 0.5) };
  return (
    <span
      aria-hidden
      className={[
        'inline-flex items-center justify-center rounded-lg shrink-0',
        'font-serif leading-none',
        m.bgClass,
        m.textClass,
      ].join(' ')}
      style={style}
    >
      {m.short[0]}
    </span>
  );
}
