import { describeDue, type DueState } from "@/lib/time";
import { Badge } from "@/components/ui/card";

const tone: Record<DueState, "neutral" | "danger" | "warning" | "accent"> = { overdue: "danger", today: "warning", tomorrow: "accent", soon: "neutral", later: "neutral", none: "neutral" };

/** Relative due-date chip, computed in the user's timezone. */
export function DueBadge({ iso, tz, done }: { iso: string | null | undefined; tz: string; done?: boolean }) {
  if (!iso) return null;
  const d = describeDue(iso, tz);
  return <Badge tone={done ? "neutral" : tone[d.state]}>{d.label}</Badge>;
}

export const PRIORITY = [
  { value: 0, label: "Low", tone: "neutral" as const },
  { value: 1, label: "Normal", tone: "neutral" as const },
  { value: 2, label: "High", tone: "warning" as const },
  { value: 3, label: "Urgent", tone: "danger" as const },
];

export const fmtPercent = (n: number | null | undefined, dp = 1) => (n == null ? "—" : `${Number(n.toFixed(dp))}%`);
/** Fixed decimals ("90.00%") — used for headline grades where consistency matters. */
export const fmtPercentFixed = (n: number | null | undefined, dp = 2) => (n == null ? "—" : `${n.toFixed(dp)}%`);
export const fmtGpa = (n: number | null | undefined) => (n == null ? "—" : n.toFixed(2));

export function formatDateTime(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}
export function formatDate(date: string) {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, d)));
}
