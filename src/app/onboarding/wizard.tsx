"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Badge } from "@/components/ui/card";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { useAction } from "@/components/ui/use-action";
import { completeOnboardingAction } from "@/app/actions/data";
import { GRADING_PRESETS, INSTITUTION_PRESETS, PERIOD_SYSTEMS, getGradingPreset, periodNames, type GradingPreset } from "@/domain/presets";
import { periodIndexContaining, splitPeriods, suggestAcademicYear } from "@/domain/calendar";
import { todayInTz } from "@/lib/time";
import { cn } from "@/lib/cn";
import { validateScale } from "@/domain/grades/engine";

const STEPS = ["About you", "University", "Grading", "Calendar"] as const;
type PeriodSystem = "trimester" | "semester" | "quarter" | "custom";

interface Band { letter: string; minPercent: string; points: string }

const toBands = (p: GradingPreset): Band[] => p.bands.map((b) => ({ letter: b.letter, minPercent: String(b.minPercent), points: String(b.points) }));

export function OnboardingWizard({ defaultName }: { defaultName: string }) {
  const { run, pending, error, fieldErrors } = useAction();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [timezones, setTimezones] = useState<string[]>([]);

  const [name, setName] = useState(defaultName);
  const [timezone, setTimezone] = useState("UTC");
  useEffect(() => {
    // Browser-only values can only be read after hydration, so they are synced here deliberately.
    /* eslint-disable react-hooks/set-state-in-effect */
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    try {
      setTimezones(Intl.supportedValuesOf("timeZone"));
    } catch {
      setTimezones([]);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const [inst, setInst] = useState({ name: "", shortName: "", country: "" });
  const [prog, setProg] = useState<{ name: string; degreeLevel: string; major: string; periodSystem: PeriodSystem }>({ name: "", degreeLevel: "bachelor", major: "", periodSystem: "semester" });
  const [presetId, setPresetId] = useState<string>("kz-4.0");

  const [gradingName, setGradingName] = useState(GRADING_PRESETS[0]!.name);
  const [rounding, setRounding] = useState<"none" | "half_up">("none");
  const [maxPoints, setMaxPoints] = useState("4");
  const [bands, setBands] = useState<Band[]>(toBands(GRADING_PRESETS[0]!));

  const today = useMemo(() => todayInTz(timezone === "UTC" ? "UTC" : timezone), [timezone]);
  const [year, setYear] = useState(() => suggestAcademicYear(todayInTz("UTC")));
  const [periods, setPeriods] = useState(() => splitPeriods(periodNames("semester", 2), year.startsOn, year.endsOn));
  const [activeIdx, setActiveIdx] = useState(0);

  function applyInstitutionPreset(id: string) {
    const p = INSTITUTION_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setInst({ name: p.name, shortName: p.shortName, country: p.country });
    setProg({ name: p.programName, degreeLevel: p.degreeLevel, major: p.major, periodSystem: p.periodSystem });
    setTimezone(p.timezone);
    applyGradingPreset(p.gradingPresetId);
    regeneratePeriods(p.periodSystem, year.startsOn, year.endsOn);
  }

  function applyGradingPreset(id: string) {
    const g = getGradingPreset(id);
    if (!g) return;
    setPresetId(id);
    setGradingName(g.name);
    setRounding(g.rounding);
    setMaxPoints(String(g.maxPoints));
    setBands(toBands(g));
  }

  function regeneratePeriods(system: PeriodSystem, startsOn: string, endsOn: string) {
    const count = PERIOD_SYSTEMS.find((s) => s.value === system)!.count;
    const next = splitPeriods(periodNames(system, count), startsOn, endsOn);
    setPeriods(next);
    setActiveIdx(periodIndexContaining(next, todayInTz("UTC")));
  }

  const parsedBands = bands.map((b) => ({ letter: b.letter.trim(), minPercent: Number(b.minPercent), points: Number(b.points) }));
  const bandErrors = useMemo(() => {
    if (parsedBands.some((b) => !b.letter || Number.isNaN(b.minPercent) || Number.isNaN(b.points))) return ["Every band needs a letter, a minimum % and points."];
    const letters = new Set(parsedBands.map((b) => b.letter));
    return [...validateScale(parsedBands), ...(letters.size !== parsedBands.length ? ["Each letter can only be used once."] : [])];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bands]);

  const stepValid = [
    name.trim().length > 0 && timezone.length > 0,
    inst.name.trim().length > 0 && prog.name.trim().length > 0 && /^[A-Za-z]{2}$/.test(inst.country || "KZ"),
    bandErrors.length === 0 && Number(maxPoints) > 0,
    year.label.trim().length > 0 && year.endsOn > year.startsOn && periods.every((p) => p.name.trim() && p.endsOn > p.startsOn),
  ];

  function submit() {
    void run(() =>
      completeOnboardingAction({
        displayName: name,
        timezone,
        institution: { name: inst.name, shortName: inst.shortName, country: inst.country ? inst.country.toUpperCase() : null },
        program: { name: prog.name, degreeLevel: prog.degreeLevel, major: prog.major, periodSystem: prog.periodSystem },
        grading: { name: gradingName, rounding, maxPoints: Number(maxPoints), bands: parsedBands },
        year: { label: year.label, startsOn: year.startsOn, endsOn: year.endsOn },
        periods,
        activePeriodIndex: activeIdx,
      }),
    ).then((r) => {
      if (r.ok) router.replace("/dashboard");
    });
  }

  return (
    <div className="animate-fade-in">
      <ol className="mb-6 flex items-center gap-2 text-xs" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2" aria-current={i === step ? "step" : undefined}>
            <span className={cn("flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold", i < step ? "border-accent bg-accent text-on-accent" : i === step ? "border-accent text-accent-text" : "border-line text-subtle")}>
              {i < step ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span className={cn("hidden sm:inline", i === step ? "text-fg" : "text-subtle")}>{s}</span>
            {i < STEPS.length - 1 && <span className="h-px w-5 bg-line sm:w-8" />}
          </li>
        ))}
      </ol>

      <Card className="p-5">
        {step === 0 && (
          <section className="space-y-4">
            <Heading title="Welcome — let's set up your workspace" text="This takes about two minutes. Everything can be changed later in Settings." />
            <Field label="Your name" error={fieldErrors.displayName}>{(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />}</Field>
            <Field label="Timezone" hint="Used for deadlines, “today” and your timetable." error={fieldErrors.timezone}>
              {(p) => (
                <>
                  <Input {...p} list="tz-list" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
                  {timezones.length > 0 && <datalist id="tz-list">{timezones.map((t) => <option key={t} value={t} />)}</datalist>}
                </>
              )}
            </Field>
          </section>
        )}

        {step === 1 && (
          <section className="space-y-4">
            <Heading title="Your university and programme" text="University OS is not tied to any institution. Pick a starting point or enter your own." />
            <div className="flex flex-wrap gap-2">
              {INSTITUTION_PRESETS.map((p) => (
                <Button key={p.id} variant="secondary" size="sm" onClick={() => applyInstitutionPreset(p.id)}>
                  {p.name} <Badge tone="accent">{p.programName}</Badge>
                </Button>
              ))}
              <Badge>or fill in your own</Badge>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="University" error={fieldErrors["institution.name"]} className="sm:col-span-2">{(p) => <Input {...p} value={inst.name} onChange={(e) => setInst({ ...inst, name: e.target.value })} placeholder="e.g. University of Example" />}</Field>
              <Field label="Short name">{(p) => <Input {...p} value={inst.shortName} onChange={(e) => setInst({ ...inst, shortName: e.target.value })} maxLength={30} />}</Field>
              <Field label="Country code" hint="2 letters, e.g. KZ">{(p) => <Input {...p} value={inst.country} onChange={(e) => setInst({ ...inst, country: e.target.value.toUpperCase().slice(0, 2) })} maxLength={2} />}</Field>
              <Field label="Programme" className="sm:col-span-2">{(p) => <Input {...p} value={prog.name} onChange={(e) => setProg({ ...prog, name: e.target.value })} placeholder="e.g. BSc Software Engineering" />}</Field>
              <Field label="Degree level">
                {(p) => (
                  <Select {...p} value={prog.degreeLevel} onChange={(e) => setProg({ ...prog, degreeLevel: e.target.value })}>
                    {["certificate", "diploma", "bachelor", "master", "doctorate", "other"].map((d) => <option key={d} value={d}>{d[0]!.toUpperCase() + d.slice(1)}</option>)}
                  </Select>
                )}
              </Field>
              <Field label="Major">{(p) => <Input {...p} value={prog.major} onChange={(e) => setProg({ ...prog, major: e.target.value })} />}</Field>
              <Field label="Academic periods" className="sm:col-span-2">
                {(p) => (
                  <Select {...p} value={prog.periodSystem} onChange={(e) => { const s = e.target.value as PeriodSystem; setProg({ ...prog, periodSystem: s }); regeneratePeriods(s, year.startsOn, year.endsOn); }}>
                    {PERIOD_SYSTEMS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </Select>
                )}
              </Field>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4">
            <Heading title="Grading scale" text="Used to turn percentages into letters and GPA. Presets are common conventions — verify them against your university's official rules, and edit anything that differs." />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Start from">
                {(p) => (
                  <Select {...p} value={presetId} onChange={(e) => applyGradingPreset(e.target.value)}>
                    {GRADING_PRESETS.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </Select>
                )}
              </Field>
              <Field label="Scale maximum (GPA)">{(p) => <Input {...p} type="number" step="0.1" min="0.1" value={maxPoints} onChange={(e) => setMaxPoints(e.target.value)} />}</Field>
              <Field label="Percent rounding">
                {(p) => (
                  <Select {...p} value={rounding} onChange={(e) => setRounding(e.target.value as "none" | "half_up")}>
                    <option value="none">None (exact)</option>
                    <option value="half_up">Round half up</option>
                  </Select>
                )}
              </Field>
            </div>
            <BandEditor bands={bands} onChange={setBands} />
            {bandErrors.length > 0 && <FormError message={bandErrors[0]} />}
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4">
            <Heading title="Academic calendar" text="These dates are suggestions that split the year evenly. Replace them with the dates from your university's official calendar." />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Academic year">{(p) => <Input {...p} value={year.label} onChange={(e) => setYear({ ...year, label: e.target.value })} />}</Field>
              <Field label="Starts">{(p) => <Input {...p} type="date" value={year.startsOn} onChange={(e) => { setYear({ ...year, startsOn: e.target.value }); }} />}</Field>
              <Field label="Ends">{(p) => <Input {...p} type="date" value={year.endsOn} onChange={(e) => { setYear({ ...year, endsOn: e.target.value }); }} />}</Field>
            </div>
            <Button variant="ghost" size="sm" onClick={() => regeneratePeriods(prog.periodSystem, year.startsOn, year.endsOn)}>Re-split periods evenly</Button>
            <div className="space-y-2" role="radiogroup" aria-label="Current period">
              {periods.map((p, i) => (
                <div key={i} className="grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-2">
                  <input type="radio" name="active" checked={activeIdx === i} onChange={() => setActiveIdx(i)} aria-label={`${p.name} is the current period`} className="accent-[var(--color-accent)]" />
                  <Input aria-label="Period name" value={p.name} onChange={(e) => setPeriods(periods.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  <Input aria-label={`${p.name} starts`} type="date" value={p.startsOn} onChange={(e) => setPeriods(periods.map((x, j) => (j === i ? { ...x, startsOn: e.target.value } : x)))} />
                  <Input aria-label={`${p.name} ends`} type="date" value={p.endsOn} onChange={(e) => setPeriods(periods.map((x, j) => (j === i ? { ...x, endsOn: e.target.value } : x)))} />
                </div>
              ))}
            </div>
            <p className="text-xs text-subtle">Select the period you are in now ({today}). You can add years and periods any time.</p>
            <FormError message={error} />
          </section>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
          <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 0 || pending}>
            <ChevronLeft className="h-3.5 w-3.5" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button variant="primary" onClick={() => setStep(step + 1)} disabled={!stepValid[step]}>
              Continue
            </Button>
          ) : (
            <Button variant="primary" onClick={submit} disabled={!stepValid[step]} loading={pending}>
              Create my workspace
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function Heading({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h1 className="text-base font-semibold">{title}</h1>
      <p className="mt-0.5 text-xs text-subtle">{text}</p>
    </div>
  );
}

export function BandEditor({ bands, onChange }: { bands: Band[]; onChange: (b: Band[]) => void }) {
  const set = (i: number, k: keyof Band, v: string) => onChange(bands.map((b, j) => (j === i ? { ...b, [k]: v } : b)));
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-[11px] uppercase tracking-wide text-subtle">
        <span>Letter</span><span>From %</span><span>GPA points</span><span className="w-8" />
      </div>
      {bands.map((b, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
          <Input aria-label="Letter" value={b.letter} maxLength={6} onChange={(e) => set(i, "letter", e.target.value)} />
          <Input aria-label="Minimum percent" type="number" step="0.01" min="0" max="100" value={b.minPercent} onChange={(e) => set(i, "minPercent", e.target.value)} />
          <Input aria-label="Grade points" type="number" step="0.01" min="0" value={b.points} onChange={(e) => set(i, "points", e.target.value)} />
          <Button variant="ghost" size="icon" aria-label={`Remove ${b.letter || "band"}`} onClick={() => onChange(bands.filter((_, j) => j !== i))} disabled={bands.length <= 1}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button variant="ghost" size="sm" onClick={() => onChange([...bands, { letter: "", minPercent: "0", points: "0" }])}>
        <Plus className="h-3.5 w-3.5" /> Add band
      </Button>
    </div>
  );
}
