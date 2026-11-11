"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Archive, Download, Plus, Star } from "lucide-react";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { useAction } from "@/components/ui/use-action";
import { changePasswordAction, deleteAccountAction } from "@/app/actions/auth";
import { createPeriodAction, createYearAction, replaceScaleAction, setActivePeriodAction, setPeriodArchivedAction, updatePreferencesAction, updateProfileAction } from "@/app/actions/data";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { BandEditor } from "@/app/onboarding/wizard";
import { validateScale } from "@/domain/grades/engine";
import { formatDate } from "@/components/format";
import { NOTIFICATION_CATEGORIES } from "@/server/services/notification-meta";
import type { Period, Year } from "@/server/services/academics";

export function ProfileSection({ name, timezone, weekStartsOn }: { name: string; timezone: string; weekStartsOn: number }) {
  const [f, setF] = useState({ name, timezone, week: String(weekStartsOn) });
  const [tzs, setTzs] = useState<string[]>([]);
  // Timezone suggestions come from the browser, so they are read after hydration.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { try { setTzs(Intl.supportedValuesOf("timeZone")); } catch { /* optional */ } }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  const { run, pending, error, fieldErrors } = useAction();
  return (
    <Card id="profile">
      <CardHeader title="Profile" description="Your timezone controls what “today” and deadline times mean." />
      <form className="grid gap-3.5 p-4 sm:grid-cols-3" onSubmit={async (e) => { e.preventDefault(); const a = await run(() => updateProfileAction({ displayName: f.name, timezone: f.timezone })); if (a.ok) await run(() => updatePreferencesAction({ weekStartsOn: Number(f.week) }), { success: "Profile saved", refresh: true }); }}>
        <div className="sm:col-span-3"><FormError message={error} /></div>
        <Field label="Name" error={fieldErrors.displayName}>{(p) => <Input {...p} required maxLength={100} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
        <Field label="Timezone" error={fieldErrors.timezone}>{(p) => <><Input {...p} list="tz" value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })} />{tzs.length > 0 && <datalist id="tz">{tzs.map((t) => <option key={t} value={t} />)}</datalist>}</>}</Field>
        <Field label="Week starts on">{(p) => <Select {...p} value={f.week} onChange={(e) => setF({ ...f, week: e.target.value })}><option value="1">Monday</option><option value="0">Sunday</option><option value="6">Saturday</option></Select>}</Field>
        <div className="sm:col-span-3"><Button type="submit" variant="primary" loading={pending}>Save profile</Button></div>
      </form>
    </Card>
  );
}

export function AppearanceSection({ theme }: { theme: "light" | "dark" | "system" }) {
  return (
    <Card id="appearance">
      <CardHeader title="Appearance" description="Saved to your account, so it follows you to other devices. “System” follows your device setting." />
      <div className="p-4"><ThemeSwitcher saved={theme} /></div>
    </Card>
  );
}

export function NotificationSection({ prefs }: { prefs: Record<string, boolean> }) {
  const [state, setState] = useState(() => Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c.id, prefs[c.id] !== false])));
  const { run } = useAction();
  return (
    <Card id="notifications">
      <CardHeader title="Notifications" description="In-app only for now. Browser/PWA push and email arrive in a later milestone; email will only be offered once a provider is configured." />
      <ul className="divide-y divide-line px-4 py-1">
        {NOTIFICATION_CATEGORIES.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-4 py-3">
            <div><p className="text-[13px] font-medium">{c.label}</p><p className="text-xs text-subtle">{c.description}</p></div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input type="checkbox" role="switch" className="peer sr-only" checked={state[c.id]} onChange={(e) => { const next = { ...state, [c.id]: e.target.checked }; setState(next); void run(() => updatePreferencesAction({ notificationPreferences: next }), { success: "Preference saved" }); }} aria-label={`${c.label} notifications`} />
              <span className="h-5 w-9 rounded-full border border-line-strong bg-raised transition-colors peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent" />
              <span className="absolute left-0.5 h-4 w-4 rounded-full bg-fg transition-transform peer-checked:translate-x-4 peer-checked:bg-bg" />
            </label>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function AcademicsSection({ years, periods, programId, activePeriodId, system }: { years: Year[]; periods: Period[]; programId: string; activePeriodId: string; system: "trimester" | "semester" | "quarter" | "custom" }) {
  const router = useRouter();
  const { run, pending, error } = useAction();
  const [y, setY] = useState({ label: "", startsOn: "", endsOn: "" });
  const [p, setP] = useState({ yearId: years[years.length - 1]?.id ?? "", name: "", startsOn: "", endsOn: "" });
  return (
    <Card id="academics">
      <CardHeader title="Academic years & periods" description="Courses belong to a period. Archive old periods to keep them out of your switcher; their data stays." />
      <div className="space-y-5 p-4">
        {years.map((yr) => (
          <div key={yr.id}>
            <p className="mb-1.5 text-xs font-semibold">{yr.label} <span className="font-normal text-subtle">· {formatDate(yr.startsOn)} – {formatDate(yr.endsOn)}</span></p>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {periods.filter((x) => x.academicYearId === yr.id).map((per) => (
                <li key={per.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-[13px]">
                  <span className="min-w-0 flex-1">{per.name} <span className="text-xs text-subtle">· {formatDate(per.startsOn)} – {formatDate(per.endsOn)}</span></span>
                  {per.id === activePeriodId && <Badge tone="accent">Selected</Badge>}
                  {per.archivedAt && <Badge>Archived</Badge>}
                  {per.id !== activePeriodId && <Button size="sm" variant="ghost" onClick={() => void run(() => setActivePeriodAction(per.id), { success: `${per.name} selected` })}><Star className="h-3.5 w-3.5" /> Select</Button>}
                  <Button size="sm" variant="ghost" onClick={() => void run(() => setPeriodArchivedAction({ periodId: per.id, archived: !per.archivedAt }), { success: per.archivedAt ? "Restored" : "Archived" })}><Archive className="h-3.5 w-3.5" /> {per.archivedAt ? "Restore" : "Archive"}</Button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <FormError message={error} />
        <div className="grid gap-6 lg:grid-cols-2">
          <form className="space-y-2.5" onSubmit={async (e) => { e.preventDefault(); const r = await run(() => createYearAction({ programId, ...y }), { success: "Academic year added" }); if (r.ok) { setY({ label: "", startsOn: "", endsOn: "" }); router.refresh(); } }}>
            <p className="text-xs font-semibold">Add an academic year</p>
            <Input aria-label="Year label" placeholder="e.g. 2027–2028" required value={y.label} onChange={(e) => setY({ ...y, label: e.target.value })} />
            <div className="grid grid-cols-2 gap-2"><Input aria-label="Year starts" type="date" required value={y.startsOn} onChange={(e) => setY({ ...y, startsOn: e.target.value })} /><Input aria-label="Year ends" type="date" required value={y.endsOn} onChange={(e) => setY({ ...y, endsOn: e.target.value })} /></div>
            <Button type="submit" loading={pending}><Plus className="h-3.5 w-3.5" /> Add year</Button>
          </form>
          <form className="space-y-2.5" onSubmit={async (e) => { e.preventDefault(); const r = await run(() => createPeriodAction({ academicYearId: p.yearId, kind: system, name: p.name, startsOn: p.startsOn, endsOn: p.endsOn }), { success: "Period added" }); if (r.ok) setP({ ...p, name: "", startsOn: "", endsOn: "" }); }}>
            <p className="text-xs font-semibold">Add a period</p>
            <Select aria-label="Academic year" value={p.yearId} onChange={(e) => setP({ ...p, yearId: e.target.value })}>{years.map((yr) => <option key={yr.id} value={yr.id}>{yr.label}</option>)}</Select>
            <Input aria-label="Period name" placeholder={`e.g. ${system === "trimester" ? "Trimester 3" : "Semester 2"}`} required value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-2"><Input aria-label="Period starts" type="date" required value={p.startsOn} onChange={(e) => setP({ ...p, startsOn: e.target.value })} /><Input aria-label="Period ends" type="date" required value={p.endsOn} onChange={(e) => setP({ ...p, endsOn: e.target.value })} /></div>
            <Button type="submit" loading={pending} disabled={!p.yearId}><Plus className="h-3.5 w-3.5" /> Add period</Button>
          </form>
        </div>
      </div>
    </Card>
  );
}

export function ScaleSection({ scaleId, name, rounding, bands, passPercent, minFinalPercent }: { scaleId: string; name: string; rounding: "none" | "half_up"; bands: { letter: string; minPercent: number; points: number }[]; passPercent: number | null; minFinalPercent: number | null }) {
  const [rows, setRows] = useState(bands.map((b) => ({ letter: b.letter, minPercent: String(b.minPercent), points: String(b.points) })));
  const [round, setRound] = useState(rounding);
  const [pass, setPass] = useState(passPercent == null ? "" : String(passPercent));
  const [minFinal, setMinFinal] = useState(minFinalPercent == null ? "" : String(minFinalPercent));
  const { run, pending, error } = useAction();
  const parsed = rows.map((r) => ({ letter: r.letter.trim(), minPercent: Number(r.minPercent), points: Number(r.points) }));
  const problems = parsed.some((b) => !b.letter || Number.isNaN(b.minPercent) || Number.isNaN(b.points)) ? ["Every band needs a letter, a minimum % and points."] : [...validateScale(parsed), ...(new Set(parsed.map((b) => b.letter)).size !== parsed.length ? ["Each letter can only be used once."] : [])];
  return (
    <Card id="grading">
      <CardHeader title="Grading scale" description={`${name}. Changing it re-calculates every grade and GPA — nothing is stored per course.`} />
      <div className="space-y-4 p-4">
        <Field label="Percent rounding before lookup" className="max-w-xs">{(p) => <Select {...p} value={round} onChange={(e) => setRound(e.target.value as "none" | "half_up")}><option value="none">None (exact)</option><option value="half_up">Round half up</option></Select>}</Field>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="Minimum passing percent (optional)" hint="Leave empty if you don’t know — the app never assumes a pass mark.">{(p) => <Input {...p} type="number" min={0} max={100} step="0.1" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="e.g. 50" />}</Field>
          <Field label="Minimum final exam percent (optional)" hint="Only if your university sets one.">{(p) => <Input {...p} type="number" min={0} max={100} step="0.1" value={minFinal} onChange={(e) => setMinFinal(e.target.value)} placeholder="e.g. 30" />}</Field>
        </div>
        <BandEditor bands={rows} onChange={setRows} />
        {problems[0] && <FormError message={problems[0]} />}
        <FormError message={error} />
        <Button variant="primary" loading={pending} disabled={problems.length > 0} onClick={() => void run(() => replaceScaleAction({ scaleId, rounding: round, bands: parsed, passPercent: pass === "" ? null : Number(pass), minFinalPercent: minFinal === "" ? null : Number(minFinal) }), { success: "Grading scale saved" })}>Save scale</Button>
      </div>
    </Card>
  );
}

export function SecuritySection() {
  const [f, setF] = useState({ currentPassword: "", newPassword: "" });
  const { run, pending, error, fieldErrors } = useAction();
  return (
    <Card id="security">
      <CardHeader title="Security" description="Changing your password signs you out of all other devices." />
      <form className="grid gap-3.5 p-4 sm:grid-cols-2" onSubmit={async (e) => { e.preventDefault(); const r = await run(() => changePasswordAction(f), { success: "Password changed" }); if (r.ok) setF({ currentPassword: "", newPassword: "" }); }}>
        <div className="sm:col-span-2"><FormError message={error} /></div>
        <Field label="Current password" error={fieldErrors.currentPassword}>{(p) => <Input {...p} type="password" autoComplete="current-password" required value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} />}</Field>
        <Field label="New password" hint="At least 8 characters" error={fieldErrors.newPassword}>{(p) => <Input {...p} type="password" autoComplete="new-password" required minLength={8} value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} />}</Field>
        <div className="sm:col-span-2"><Button type="submit" loading={pending}>Change password</Button></div>
      </form>
    </Card>
  );
}

export function DataSection({ email }: { email: string }) {
  const [confirm, setConfirm] = useState("");
  const { run, pending, error, fieldErrors } = useAction();
  return (
    <Card id="data">
      <CardHeader title="Your data" description="You own it. Export everything or delete your account permanently." />
      <div className="space-y-5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-md text-xs text-muted">Download a complete JSON export of your profile, courses, assessments, tasks, notes and settings.</p>
          <a href="/api/v1/me/export" download><Button><Download className="h-3.5 w-3.5" /> Export my data</Button></a>
        </div>
        <form className="space-y-2.5 rounded-lg border border-danger-border bg-danger-soft/40 p-3.5" onSubmit={(e) => { e.preventDefault(); void run(() => deleteAccountAction({ confirmEmail: confirm })); }}>
          <p className="text-[13px] font-semibold text-danger">Delete account</p>
          <p className="text-xs text-muted">This permanently deletes your account and every record in it. It cannot be undone. Type <strong className="text-fg">{email}</strong> to confirm.</p>
          <FormError message={error} />
          <Field label="Confirm email" error={fieldErrors.confirmEmail}>{(p) => <Input {...p} autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}</Field>
          <Button type="submit" variant="danger" loading={pending} disabled={confirm.trim().toLowerCase() !== email.toLowerCase()}>Permanently delete my account</Button>
        </form>
      </div>
    </Card>
  );
}
