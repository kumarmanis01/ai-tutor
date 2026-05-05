/**
 * FILE OBJECTIVE:
 * - Minimal layout for enrollment flow: no Topbar, no BottomNav.
 * - Full-screen white/dark background for focused onboarding experience.
 *
 * EDIT LOG:
 * - 2026-05-05 | claude | created for enrollment flow
 */

export default function EnrollLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {children}
    </div>
  );
}
