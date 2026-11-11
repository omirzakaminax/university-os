import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/card";
import { AcademicsSection, AppearanceSection, DataSection, NotificationSection, ProfileSection, ScaleSection, SecuritySection } from "@/components/settings/sections";
import { IntegrationStatus } from "@/components/settings/status";
import { AiSection } from "@/components/settings/ai-section";
import { getAppContext } from "@/server/app-context";
import { withUser } from "@/server/db/client";
import { aiStatus } from "@/server/env";
import { hasConsent, usageToday } from "@/server/ai";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const app = await getAppContext();
  const { academic } = app;
  const ai = aiStatus();
  const { consented, usage } = await withUser(app.userId, async (tx) => ({ consented: await hasConsent(tx), usage: await usageToday(tx) }));
  return (
    <>
      <PageHeader title="Settings" description={`${academic.institution.name} · ${academic.program.name}`} />
      <div className="max-w-3xl space-y-4">
        <ProfileSection name={app.profile.displayName} timezone={app.profile.timezone} weekStartsOn={app.prefs.weekStartsOn} />
        <AppearanceSection theme={app.prefs.theme} />
        <AcademicsSection years={academic.years} periods={academic.periods} programId={academic.program.id} activePeriodId={academic.activePeriod.id} system={academic.program.periodSystem} />
        <ScaleSection scaleId={academic.scale.id} name={academic.scale.name} rounding={academic.scale.rounding} bands={academic.scale.bands} passPercent={academic.scale.passPercent} minFinalPercent={academic.scale.minFinalPercent} />
        <AiSection configured={ai.configured} provider={ai.provider} consented={consented} usage={usage} />
        <NotificationSection prefs={app.prefs.notificationPreferences} />
        <IntegrationStatus />
        <SecuritySection />
        <DataSection email={app.email} />
      </div>
    </>
  );
}
