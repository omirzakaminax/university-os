import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/server/auth/session";
import { withUser } from "@/server/db/client";
import { getPreferences, getProfile, type Preferences, type Profile } from "@/server/services/profile";
import { getAcademicContext, type AcademicContext } from "@/server/services/academics";
import { syncNotifications, unreadCount } from "@/server/services/notifications";
import { listCourses, type CourseRow } from "@/server/services/courses";
import { todayInTz } from "@/lib/time";

export interface AppContext {
  userId: string;
  email: string;
  profile: Profile;
  prefs: Preferences;
  academic: AcademicContext;
  today: string;
  unread: number;
  /** Courses in the active period (for pickers and quick capture). */
  courses: CourseRow[];
}

/**
 * Everything the shell and most pages need, loaded once per request.
 * Redirects to /login or /onboarding as appropriate, so pages can assume a fully set-up user.
 */
export const getAppContext = cache(async (): Promise<AppContext> => {
  const session = await getSession();
  if (!session) redirect("/login");
  const loaded = await withUser(session.userId, async (tx) => {
    const profile = await getProfile(tx);
    if (!profile.onboardingCompletedAt) return null;
    const prefs = await getPreferences(tx);
    const today = todayInTz(profile.timezone);
    const academic = await getAcademicContext(tx, today);
    if (!academic) return null;
    await syncNotifications(tx, profile.timezone, prefs.notificationPreferences);
    const [unread, courses] = await Promise.all([unreadCount(tx), listCourses(tx, { periodId: academic.activePeriod.id })]);
    return { profile, prefs, academic, today, unread, courses };
  });
  if (!loaded) redirect("/onboarding");
  return { userId: session.userId, email: session.email, ...loaded };
});
