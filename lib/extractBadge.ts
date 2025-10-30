export type BadgeViewLocal = {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
};

type UserBadgeItem = {
  id?: string;
  badge?: {
    id?: string;
    name?: string | null;
    description?: string | null;
    icon?: string | null;
  } | null;
  name?: string | null;
  description?: string | null;
  icon?: string | null;
};

export function extractBadges(profile: unknown): BadgeViewLocal[] {
  if (!profile || typeof profile !== 'object') return [];

  const p = profile as Record<string, unknown>;
  const candidate = Array.isArray(p.userBadges)
    ? p.userBadges
    : Array.isArray(p.badges)
      ? p.badges
      : null;
  if (!candidate) return [];

  return (candidate as UserBadgeItem[]).map((ub) => ({
    id: ub.badge?.id ?? ub.id ?? '',
    name: ub.badge?.name ?? ub.name ?? 'Badge',
    description: ub.badge?.description ?? ub.description ?? undefined,
    icon: ub.badge?.icon ?? ub.icon ?? undefined,
  }));
}
