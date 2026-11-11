import Link from "next/link";
import { Logo } from "@/components/brand";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo />
      <h1 className="text-lg font-semibold">We couldn’t find that page</h1>
      <p className="max-w-sm text-[13px] text-muted">It may have been deleted, or it never existed in your workspace.</p>
      <Link href="/dashboard" className="rounded-lg bg-accent px-3 py-1.5 text-[13px] font-medium text-on-accent hover:bg-accent-strong">Back to dashboard</Link>
    </main>
  );
}
