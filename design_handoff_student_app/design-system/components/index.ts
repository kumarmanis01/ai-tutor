/**
 * Barrel export for design-system primitives.
 *
 * Copy this whole folder to:  components/UI/design-system/
 *
 * Then import in screens via:
 *   import { Button, Card, Pill, ReadinessPill, KV, DayDot, Ring,
 *            SubjectChip, SubjectGlyph, missionCta, readinessTier } from '@/components/UI/design-system';
 *
 * The lib helpers (missionCta, readinessTier) belong in:
 *   lib/learning/missionCta.ts
 *   lib/learning/readinessTiers.ts
 * — re-exported here for convenience only.
 */

export { Button } from './Button';
export type { ButtonProps } from './Button';

export { Card } from './Card';

export { Pill, ReadinessPill } from './Pill';

export { KV } from './KV';

export { DayDot } from './DayDot';

export { Ring } from './Ring';

export { SubjectChip, SubjectGlyph, subjectMeta } from './SubjectChip';
export type { SubjectId } from './SubjectChip';

export { missionCta } from './missionCta';
export type {
  MissionCtaResult,
  MissionCtaVariant,
  MissionKind,
  MissionState,
} from './missionCta';

export {
  readinessTier,
  readinessLabel,
  READINESS_STYLE,
} from './readinessTiers';
export type { ReadinessTier } from './readinessTiers';
