import { addDays, diffDays } from "@/lib/time";

/** Suggested academic year range for a given date: starts 1 Sept (the common northern-hemisphere convention). Always editable. */
export function suggestAcademicYear(today: string): { label: string; startsOn: string; endsOn: string } {
  const [y, m] = today.split("-").map(Number) as [number, number];
  const startYear = m >= 8 ? y : y - 1;
  return { label: `${startYear}–${startYear + 1}`, startsOn: `${startYear}-09-01`, endsOn: `${startYear + 1}-06-30` };
}

/**
 * Split [startsOn, endsOn] into `count` consecutive periods of (nearly) equal length.
 * These are SUGGESTIONS to be edited against the university's official calendar — never presented as official dates.
 */
export function splitPeriods(names: string[], startsOn: string, endsOn: string): { name: string; startsOn: string; endsOn: string }[] {
  const total = diffDays(startsOn, endsOn) + 1;
  const n = names.length;
  const base = Math.floor(total / n);
  let cursor = startsOn;
  return names.map((name, i) => {
    const len = i === n - 1 ? diffDays(cursor, endsOn) + 1 : base;
    const end = addDays(cursor, len - 1);
    const period = { name, startsOn: cursor, endsOn: end };
    cursor = addDays(end, 1);
    return period;
  });
}

export function periodIndexContaining(periods: { startsOn: string; endsOn: string }[], today: string): number {
  const i = periods.findIndex((p) => p.startsOn <= today && today <= p.endsOn);
  if (i >= 0) return i;
  const started = periods.map((p, idx) => ({ p, idx })).filter(({ p }) => p.startsOn <= today);
  return started.length ? started[started.length - 1]!.idx : 0;
}
