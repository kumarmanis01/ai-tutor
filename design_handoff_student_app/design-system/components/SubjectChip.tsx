/**
 * SubjectChip / SubjectGlyph — subject identity primitives.
 *
 * Subject colors live in tailwind.config.js as `subject-*` tokens. Never invent
 * per-subject hex codes in components.
 *
 * USAGE:
 *   <SubjectChip subjectId="mathematics" />               // inline tag with letter + name
 *   <SubjectGlyph subjectId="science" size={36} />        // square icon tile (no label)
 */

export type SubjectId =
  | 'mathematics'
  | 'physics'
  | 'chemistry'
  | 'biology'
  | 'science'      // umbrella id for grades that use a single "Science"
  | 'english'
  | 'social'
  | 'hindi';

interface SubjectMeta {
  short: string;
  name: string;
  /** Tailwind utility for the subject's primary color */
  textClass: string;
  /** Tailwind utility for the subject's soft background */
  bgClass: string;
}

const SUBJECT_META: Record<SubjectId, SubjectMeta> = {
  mathematics: { short: 'Math',     name: 'Mathematics',    textClass: 'text-subject-mathematics', bgClass: 'bg-subject-mathematics-bg' },
  physics:     { short: 'Physics',  name: 'Physics',        textClass: 'text-subject-physics',     bgClass: 'bg-subject-physics-bg' },
  chemistry:   { short: 'Chem',     name: 'Chemistry',      textClass: 'text-subject-chemistry',   bgClass: 'bg-subject-chemistry-bg' },
  biology:     { short: 'Bio',      name: 'Biology',        textClass: 'text-subject-biology',     bgClass: 'bg-subject-biology-bg' },
  science:     { short: 'Science',  name: 'Science',        textClass: 'text-subject-physics',     bgClass: 'bg-subject-physics-bg' },
  english:     { short: 'English',  name: 'English',        textClass: 'text-subject-english',     bgClass: 'bg-subject-english-bg' },
  social:      { short: 'Social',   name: 'Social Studies', textClass: 'text-subject-social',      bgClass: 'bg-subject-social-bg' },
  hindi:       { short: 'Hindi',    name: 'Hindi',          textClass: 'text-subject-hindi',       bgClass: 'bg-subject-hindi-bg' },
};

export function subjectMeta(id: SubjectId): SubjectMeta {
  return SUBJECT_META[id];
}

export function SubjectChip({ subjectId }: { subjectId: SubjectId }) {
  const m = SUBJECT_META[subjectId];
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 pl-1 pr-2.5 py-0.5 rounded-full',
        'text-xs font-medium leading-tight',
        m.bgClass,
        m.textClass,
      ].join(' ')}
    >
      <span
        aria-hidden
        className={[
          'inline-flex items-center justify-center w-4 h-4 rounded',
          'text-[9px] font-serif text-white',
          // The inner square uses the subject's solid color via inline style fallback
          // so we don't need a second per-subject utility. The currentColor of
          // the parent is the subject text color; we want the square SOLID.
          // Easiest: tint the parent text utility for inverse use here:
          m.textClass.replace('text-subject', 'bg-subject'),
        ].join(' ')}
      >
        {m.short[0]}
      </span>
      {m.short}
    </span>
  );
}

interface SubjectGlyphProps {
  subjectId: SubjectId;
  /** Pixel size of the square tile. Default 36. */
  size?: number;
}

export function SubjectGlyph({ subjectId, size = 36 }: SubjectGlyphProps) {
  const m = SUBJECT_META[subjectId];
  return (
    <span
      aria-hidden
      className={[
        'inline-flex items-center justify-center rounded-lg shrink-0',
        'font-serif leading-none',
        m.bgClass,
        m.textClass,
      ].join(' ')}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}
    >
      {m.short[0]}
    </span>
  );
}
