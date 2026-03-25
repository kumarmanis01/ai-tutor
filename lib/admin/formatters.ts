/**
 * Shared admin-panel formatting utilities.
 * Pure functions -- no side effects, no imports from outside lib/.
 */

/** Map JobStatus enum value to a human-readable display string. */
export function formatJobStatus(status: string): string {
  const map: Record<string, string> = {
    pending: 'Pending',
    running: 'Running',
    failed: 'Failed',
    completed: 'Completed',
    cancelled: 'Cancelled',
    paused: 'Paused',
  };
  return map[status] ?? status;
}

/** Format a numeric grade to "Grade N". */
export function formatGrade(grade: number): string {
  return `Grade ${grade}`;
}

/** Capitalise a hyphen-separated slug: "science-physics" -> "Science Physics". */
export function formatSubjectName(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Parse a subjects value that may be stored as a JSON array string, a plain
 * string, or already an array.
 */
export function parseSubjects(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // not JSON -- treat as single subject
    }
    return [raw];
  }
  return [];
}

/** Relative human-readable time: "2 min ago", "3h ago", "5d ago". */
export function timeSince(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
