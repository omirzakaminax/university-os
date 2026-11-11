import { z } from "zod";
import { addDays, zonedLocalToUtc, utcToZonedLocalInput } from "@/lib/time";

export const recurrenceSchema = z.object({
  freq: z.enum(["daily", "weekly", "monthly"]),
  interval: z.number().int().min(1).max(52).default(1),
});
export type Recurrence = z.infer<typeof recurrenceSchema>;

/**
 * Next due instant for a recurring task, keeping the same local wall-clock time in `tz`.
 * Monthly recurrence clamps to the last day of shorter months (Jan 31 -> Feb 28/29).
 */
export function nextOccurrence(dueIso: string, rule: Recurrence, tz: string): string {
  const local = utcToZonedLocalInput(dueIso, tz); // YYYY-MM-DDTHH:mm
  const [date, time] = local.split("T") as [string, string];
  let nextDate: string;
  if (rule.freq === "daily") nextDate = addDays(date, rule.interval);
  else if (rule.freq === "weekly") nextDate = addDays(date, 7 * rule.interval);
  else {
    const [y, m, d] = date.split("-").map(Number) as [number, number, number];
    const total = m - 1 + rule.interval;
    const ny = y + Math.floor(total / 12);
    const nm = (total % 12) + 1;
    const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
    nextDate = `${String(ny).padStart(4, "0")}-${String(nm).padStart(2, "0")}-${String(Math.min(d, lastDay)).padStart(2, "0")}`;
  }
  return zonedLocalToUtc(`${nextDate}T${time}`, tz);
}
