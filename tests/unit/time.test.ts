import { describe, expect, it } from "vitest";
import { addDays, dateInTz, dayBoundsUtc, describeDue, diffDays, isoWeekday, isValidTimeZone, startOfWeek, utcToZonedLocalInput, zonedLocalToUtc } from "@/lib/time";
import { nextOccurrence } from "@/domain/recurrence";

describe("time", () => {
  it("validates timezones", () => {
    expect(isValidTimeZone("Asia/Almaty")).toBe(true);
    expect(isValidTimeZone("Mars/Base")).toBe(false);
  });
  it("converts local wall-clock in Asia/Almaty (UTC+5) to UTC and back", () => {
    const utc = zonedLocalToUtc("2026-11-12T23:59", "Asia/Almaty");
    expect(utc).toBe("2026-11-12T18:59:00.000Z");
    expect(utcToZonedLocalInput(utc, "Asia/Almaty")).toBe("2026-11-12T23:59");
  });
  it("handles DST zones (Europe/London summer vs winter)", () => {
    expect(zonedLocalToUtc("2026-07-01T09:00", "Europe/London")).toBe("2026-07-01T08:00:00.000Z");
    expect(zonedLocalToUtc("2026-12-01T09:00", "Europe/London")).toBe("2026-12-01T09:00:00.000Z");
  });
  it("finds the local date near midnight", () => {
    // 2026-11-10T20:30Z is already Nov 11 in Almaty (UTC+5)
    expect(dateInTz(new Date("2026-11-10T20:30:00Z"), "Asia/Almaty")).toBe("2026-11-11");
    expect(dateInTz(new Date("2026-11-10T20:30:00Z"), "UTC")).toBe("2026-11-10");
  });
  it("computes day bounds", () => {
    expect(dayBoundsUtc("2026-11-10", "Asia/Almaty")).toEqual({ start: "2026-11-09T19:00:00.000Z", end: "2026-11-10T19:00:00.000Z" });
  });
  it("date arithmetic", () => {
    expect(addDays("2026-02-27", 3)).toBe("2026-03-02");
    expect(isoWeekday("2026-11-10")).toBe(2); // Tuesday
    expect(isoWeekday("2026-11-15")).toBe(7);
    expect(startOfWeek("2026-11-12", 1)).toBe("2026-11-09");
    expect(startOfWeek("2026-11-15", 1)).toBe("2026-11-09");
    expect(startOfWeek("2026-11-15", 0)).toBe("2026-11-15");
    expect(diffDays("2026-11-10", "2026-11-13")).toBe(3);
  });
  it("describes due dates relative to now", () => {
    const now = new Date("2026-11-10T08:00:00Z");
    expect(describeDue(null, "UTC", now).state).toBe("none");
    expect(describeDue("2026-11-10T07:00:00Z", "UTC", now).state).toBe("overdue");
    expect(describeDue("2026-11-10T20:00:00Z", "UTC", now).state).toBe("today");
    expect(describeDue("2026-11-11T09:00:00Z", "UTC", now).state).toBe("tomorrow");
    expect(describeDue("2026-11-14T09:00:00Z", "UTC", now).state).toBe("soon");
    expect(describeDue("2026-12-14T09:00:00Z", "UTC", now).state).toBe("later");
  });
});

describe("recurrence", () => {
  const tz = "Asia/Almaty";
  it("daily / weekly keep local time", () => {
    const due = zonedLocalToUtc("2026-11-10T23:59", tz);
    expect(utcToZonedLocalInput(nextOccurrence(due, { freq: "daily", interval: 1 }, tz), tz)).toBe("2026-11-11T23:59");
    expect(utcToZonedLocalInput(nextOccurrence(due, { freq: "weekly", interval: 2 }, tz), tz)).toBe("2026-11-24T23:59");
  });
  it("monthly clamps to month end", () => {
    const due = zonedLocalToUtc("2026-01-31T10:00", tz);
    expect(utcToZonedLocalInput(nextOccurrence(due, { freq: "monthly", interval: 1 }, tz), tz)).toBe("2026-02-28T10:00");
    const dec = zonedLocalToUtc("2026-12-15T10:00", tz);
    expect(utcToZonedLocalInput(nextOccurrence(dec, { freq: "monthly", interval: 1 }, tz), tz)).toBe("2027-01-15T10:00");
  });
});

import { periodIndexContaining, splitPeriods, suggestAcademicYear } from "@/domain/calendar";

describe("calendar suggestions", () => {
  it("suggests the academic year containing a date", () => {
    expect(suggestAcademicYear("2026-11-10")).toEqual({ label: "2026–2027", startsOn: "2026-09-01", endsOn: "2027-06-30" });
    expect(suggestAcademicYear("2027-03-01").label).toBe("2026–2027");
    expect(suggestAcademicYear("2026-08-15").label).toBe("2026–2027");
  });
  it("splits a year into contiguous, gap-free periods", () => {
    const ps = splitPeriods(["T1", "T2", "T3"], "2026-09-01", "2027-06-30");
    expect(ps[0]!.startsOn).toBe("2026-09-01");
    expect(ps[2]!.endsOn).toBe("2027-06-30");
    for (let i = 1; i < ps.length; i++) expect(addDays(ps[i - 1]!.endsOn, 1)).toBe(ps[i]!.startsOn);
    expect(splitPeriods(["P1"], "2026-09-01", "2027-06-30")).toEqual([{ name: "P1", startsOn: "2026-09-01", endsOn: "2027-06-30" }]);
  });
  it("finds the period containing today", () => {
    const ps = splitPeriods(["T1", "T2", "T3"], "2026-09-01", "2027-06-30");
    expect(periodIndexContaining(ps, "2026-11-10")).toBe(0);
    expect(periodIndexContaining(ps, "2027-06-01")).toBe(2);
    expect(periodIndexContaining(ps, "2030-01-01")).toBe(2);
    expect(periodIndexContaining(ps, "2020-01-01")).toBe(0);
  });
});
