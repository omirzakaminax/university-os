import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/card";
import { WeekTimetable } from "@/components/timetable/week";
import { getAppContext } from "@/server/app-context";
import { withUser } from "@/server/db/client";
import { listSessions } from "@/server/services/timetable";
import { isoWeekday } from "@/lib/time";

export const metadata: Metadata = { title: "Timetable" };

export default async function TimetablePage() {
  const app = await getAppContext();
  const sessions = await withUser(app.userId, (tx) => listSessions(tx, { periodId: app.academic.activePeriod.id }));
  return (
    <>
      <PageHeader title="Timetable" description={`Weekly classes for ${app.academic.activePeriod.name}. Gaps of 45 minutes or more are marked as free time.`} />
      <WeekTimetable sessions={sessions} courses={app.courses.map((c) => ({ id: c.id, title: c.title }))} todayWeekday={isoWeekday(app.today)} />
    </>
  );
}
