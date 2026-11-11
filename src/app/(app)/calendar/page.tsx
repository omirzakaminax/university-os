import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAppContext } from "@/server/app-context";
import { withUser } from "@/server/db/client";
import { loadCalendarMonth } from "@/server/services/calendar";
import { addDays, isoWeekday, startOfWeek } from "@/lib/time";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Calendar" };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const sp = await searchParams;
  const app = await getAppContext();
  const tz = app.profile.timezone;
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(sp.m ?? "") ?? /^(\d{4})-(\d{2})/.exec(app.today)!;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const pad = (n: number) => String(n).padStart(2, "0");
  const first = `${year}-${pad(month)}-01`;
  const prev = month === 1 ? `${year - 1}-12` : `${year}-${pad(month - 1)}`;
  const next = month === 12 ? `${year + 1}-01` : `${year}-${pad(month + 1)}`;
  const items = await withUser(app.userId, (tx) => loadCalendarMonth(tx, year, month, tz));
  const byDate = new Map<string, typeof items>();
  for (const it of items) byDate.set(it.date, [...(byDate.get(it.date) ?? []), it]);

  const gridStart = startOfWeek(first, 1);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last = `${year}-${pad(month)}-${pad(lastDay)}`;
  const weeks = Math.ceil((isoWeekday(first) - 1 + lastDay) / 7);
  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i));
  const title = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(Date.UTC(year, month - 1, 1)));

  return (
    <>
      <PageHeader
        title="Calendar"
        description={`${title} · deadlines, assessments and exams (times in ${tz})`}
        actions={<>
          <Link href={`/calendar?m=${prev}`} aria-label="Previous month"><Button size="icon"><ChevronLeft className="h-4 w-4" /></Button></Link>
          <Link href="/calendar"><Button>Today</Button></Link>
          <Link href={`/calendar?m=${next}`} aria-label="Next month"><Button size="icon"><ChevronRight className="h-4 w-4" /></Button></Link>
        </>}
      />
      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-line bg-raised text-center text-[11px] uppercase tracking-wide text-subtle">
          {WEEKDAYS.map((d) => <div key={d} className="py-1.5">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const inMonth = d >= first && d <= last;
            const list = byDate.get(d) ?? [];
            return (
              <div key={d} className={cn("min-h-20 border-b border-r border-line p-1 sm:min-h-28 sm:p-1.5", !inMonth && "bg-bg/60", d === app.today && "bg-accent-soft")}>
                <p className={cn("mb-1 text-xs tabular-nums", inMonth ? "text-muted" : "text-subtle/60", d === app.today && "font-semibold text-accent-text")}>{Number(d.slice(8))}</p>
                <ul className="space-y-0.5">
                  {list.slice(0, 3).map((it) => (
                    <li key={`${it.type}:${it.id}`}>
                      <Link href={it.href} title={it.title} data-color={it.courseColor ?? "slate"} className={cn("block truncate rounded border-l-2 border-[var(--c)] bg-raised px-1 py-0.5 text-[11px] leading-tight hover:bg-hover", it.done && "text-subtle line-through", it.isExam && !it.done && "font-semibold text-warning")}>
                        {it.title}
                      </Link>
                    </li>
                  ))}
                  {list.length > 3 && <li className="px-1 text-[11px] text-subtle">+{list.length - 3} more</li>}
                </ul>
              </div>
            );
          })}
        </div>
      </Card>
      {items.length === 0 && <p className="mt-3 text-xs text-subtle">Nothing is due in {title}. Tasks and assessments with due dates will show up here.</p>}
    </>
  );
}
