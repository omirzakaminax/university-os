import { cn } from "@/lib/cn";

export function Logo({ className, withText = true }: { className?: string; withText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="1.5" y="1.5" width="21" height="21" rx="6" fill="url(#g)" />
        <path d="M8 8v5.2a4 4 0 0 0 8 0V8" stroke="var(--on-accent)" strokeWidth="2.2" strokeLinecap="round" />
        <defs>
          <linearGradient id="g" x1="2" y1="2" x2="22" y2="22">
            <stop stopColor="var(--sky)" />
            <stop offset="1" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
      </svg>
      {withText && <span className="text-[15px]">University OS</span>}
    </span>
  );
}
