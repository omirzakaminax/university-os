import { AppShell } from "@/components/shell/app-shell";
import { getAppContext } from "@/server/app-context";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const app = await getAppContext();
  return (
    <AppShell
      userName={app.profile.displayName}
      email={app.email}
      unread={app.unread}
      theme={app.prefs.theme}
      collapsedInitially={app.prefs.sidebarCollapsed}
      timezone={app.profile.timezone}
      institution={app.academic.institution.shortName ?? app.academic.institution.name}
      periods={app.academic.periods.filter((p) => !p.archivedAt || p.id === app.academic.activePeriod.id).map((p) => ({ id: p.id, label: `${p.yearLabel} · ${p.name}` }))}
      activePeriodId={app.academic.activePeriod.id}
      courses={app.courses.map((c) => ({ id: c.id, title: c.title }))}
    >
      {children}
    </AppShell>
  );
}
