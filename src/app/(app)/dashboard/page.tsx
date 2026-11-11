import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/card";
import { CustomizeDashboard } from "@/components/dashboard/customize";
import { AiWidget, WIDGET_COMPONENTS } from "@/components/dashboard/widgets";
import { WIDGETS } from "@/domain/widgets";
import { getAppContext } from "@/server/app-context";
import { withUser } from "@/server/db/client";
import { aiStatus } from "@/server/env";
import { loadDashboard } from "@/server/services/dashboard";
import { formatDate } from "@/components/format";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const app = await getAppContext();
  const data = await withUser(app.userId, (tx) => loadDashboard(tx, app.academic, app.profile.timezone));
  const ai = aiStatus();
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: app.profile.timezone, hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  const greeting = hour < 5 ? "Working late" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const props = { data, tz: app.profile.timezone, maxPoints: app.academic.scale.maxPoints };
  const visible = app.prefs.dashboardWidgets.filter((w) => w.visible);

  return (
    <>
      <PageHeader
        title={`${greeting}, ${app.profile.displayName.split(" ")[0] || "there"}`}
        description={`${formatDate(data.today)} · ${app.academic.activePeriod.yearLabel} ${app.academic.activePeriod.name} · ${app.academic.institution.shortName ?? app.academic.institution.name}`}
        actions={<CustomizeDashboard prefs={app.prefs.dashboardWidgets} />}
      />
      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong p-10 text-center text-sm text-muted">All widgets are hidden. Use “Customize” to bring some back.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {visible.map((w) => {
            const def = WIDGETS.find((x) => x.id === w.id)!;
            return (
              <div key={w.id} className={def.span === 2 ? "lg:col-span-2" : undefined}>
                {w.id === "ai" ? <AiWidget configured={ai.configured} provider={ai.provider} /> : WIDGET_COMPONENTS[w.id]?.(props)}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
