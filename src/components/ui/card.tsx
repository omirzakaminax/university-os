import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[var(--radius-card)] border border-line bg-surface shadow-card", className)} {...props} />;
}

export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-4 pt-3.5", className)}>
      <div className="min-w-0">
        <h2 className="truncate text-[13px] font-semibold tracking-tight text-fg">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-subtle">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Badge({ tone = "neutral", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "accent" | "success" | "warning" | "danger" }) {
  const tones = {
    neutral: "bg-raised text-muted border-line",
    accent: "bg-accent-soft text-accent-text border-accent-border",
    success: "bg-success-soft text-success border-success-border",
    warning: "bg-warning-soft text-warning border-warning-border",
    danger: "bg-danger-soft text-danger border-danger-border",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none", tones[tone], className)} {...props} />;
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-10 text-center", className)}>
      {icon && <div className="mb-1 flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-raised text-muted">{icon}</div>}
      <p className="text-[13px] font-medium text-fg">{title}</p>
      {description && <p className="max-w-xs text-xs text-subtle">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Progress({ value, className, tone = "accent", label }: { value: number; className?: string; tone?: "accent" | "success" | "warning" | "danger"; label?: string }) {
  const color = { accent: "bg-accent", success: "bg-success", warning: "bg-warning", danger: "bg-danger" }[tone];
  const v = Math.max(0, Math.min(100, value));
  return (
    <div role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label} className={cn("h-1.5 w-full overflow-hidden rounded-full bg-raised", className)}>
      <div className={cn("h-full rounded-full transition-[width] duration-300", color)} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-raised", className)} />;
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CourseDot({ color, className }: { color: string; className?: string }) {
  return <span data-color={color} aria-hidden className={cn("inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--c)]", className)} />;
}
