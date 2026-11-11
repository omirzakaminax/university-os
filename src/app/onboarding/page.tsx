import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand";
import { getSession } from "@/server/auth/session";
import { withUser } from "@/server/db/client";
import { getProfile } from "@/server/services/profile";
import { OnboardingWizard } from "./wizard";

export const metadata: Metadata = { title: "Set up your workspace" };

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const profile = await withUser(session.userId, getProfile);
  if (profile.onboardingCompletedAt) redirect("/dashboard");
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 py-10">
      <Logo className="mb-8" />
      <OnboardingWizard defaultName={profile.displayName} />
    </main>
  );
}
