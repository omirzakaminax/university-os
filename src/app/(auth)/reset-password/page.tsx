import type { Metadata } from "next";
import Link from "next/link";
import { ResetForm } from "../auth-forms";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <div className="space-y-2 text-center">
        <h1 className="text-base font-semibold">Invalid reset link</h1>
        <p className="text-[13px] text-muted">This link is missing its token. Request a new one.</p>
        <Link href="/forgot-password" className="text-sm text-accent-text hover:underline">
          Request a new link
        </Link>
      </div>
    );
  }
  return <ResetForm token={token} />;
}
