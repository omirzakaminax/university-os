import { redirect } from "next/navigation";
import { Logo } from "@/components/brand";
import { getSession } from "@/server/auth/session";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getSession()) redirect("/dashboard");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10" style={{ backgroundImage: "radial-gradient(60rem 28rem at 50% -8rem, var(--glow), transparent)" }}>
      <div className="mb-8">
        <Logo />
      </div>
      <div className="w-full max-w-sm animate-fade-in rounded-xl border border-line bg-surface p-6 shadow-pop">{children}</div>
      <p className="mt-6 max-w-sm text-center text-xs text-subtle">Your workspace is private to you. Nobody else can see your courses, grades, documents or notes.</p>
    </main>
  );
}
