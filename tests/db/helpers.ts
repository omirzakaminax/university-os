import { TEST_ADMIN_URL, TEST_APP_URL } from "./urls";

process.env.DATABASE_URL = TEST_APP_URL;
process.env.DATABASE_ADMIN_URL = TEST_ADMIN_URL;
process.env.AUTH_PROVIDER = "local";

import { adminSql, appSql, withUser, type Tx } from "@/server/db/client";
import { localAuthProvider } from "@/server/auth/local-provider";
import { completeOnboarding } from "@/server/services/profile";
import { onboardingSchema } from "@/server/schemas";
import { GRADING_PRESETS } from "@/domain/presets";

export { adminSql, appSql, withUser, localAuthProvider };
export type { Tx };

let counter = 0;

export async function createUser(label = "u"): Promise<{ userId: string; email: string }> {
  const email = `${label}-${Date.now()}-${counter++}@example.test`;
  const { userId } = await localAuthProvider.signUp({ email, password: "correct horse battery", displayName: label.toUpperCase() });
  return { userId, email };
}

export const ONBOARDING = onboardingSchema.parse({
  displayName: "Test Student",
  timezone: "Asia/Almaty",
  institution: { name: "Astana IT University", shortName: "AITU", country: "KZ" },
  program: { name: "BSc Software Engineering", degreeLevel: "bachelor", major: "Software Engineering", periodSystem: "trimester" },
  grading: { name: "Kazakhstan 4.0", rounding: "none", maxPoints: 4, bands: GRADING_PRESETS[0]!.bands },
  year: { label: "2026–2027", startsOn: "2026-09-01", endsOn: "2027-06-30" },
  periods: [
    { name: "Trimester 1", startsOn: "2026-09-01", endsOn: "2026-12-15" },
    { name: "Trimester 2", startsOn: "2026-12-16", endsOn: "2027-03-31" },
  ],
  activePeriodIndex: 0,
});

/** Create a user, onboard them, and return ids needed by tests. */
export async function createOnboardedUser(label = "u") {
  const u = await createUser(label);
  const { activePeriodId } = await withUser(u.userId, (tx) => completeOnboarding(tx, ONBOARDING));
  return { ...u, periodId: activePeriodId };
}

export async function closeAll() {
  await appSql().end({ timeout: 2 });
  await adminSql().end({ timeout: 2 });
}
