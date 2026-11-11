/**
 * Starting points offered during onboarding. They are COPIED into the user's own rows and are fully
 * editable — nothing here is a global assumption of the application.
 *
 * Presets describe common conventions, not official regulations: users are told to verify them
 * against their university's published rules.
 */
import type { GradeBand } from "@/domain/grades/engine";

export interface GradingPreset {
  id: string;
  name: string;
  description: string;
  rounding: "none" | "half_up";
  maxPoints: number;
  bands: GradeBand[];
}

export const GRADING_PRESETS: GradingPreset[] = [
  {
    id: "kz-4.0",
    name: "Kazakhstan 4.0 (letter + GPA)",
    description: "The 4.0 letter scale widely used by Kazakhstani universities. Verify the thresholds against your university's regulations.",
    rounding: "none",
    maxPoints: 4,
    bands: [
      { letter: "A", minPercent: 95, points: 4.0 },
      { letter: "A-", minPercent: 90, points: 3.67 },
      { letter: "B+", minPercent: 85, points: 3.33 },
      { letter: "B", minPercent: 80, points: 3.0 },
      { letter: "B-", minPercent: 75, points: 2.67 },
      { letter: "C+", minPercent: 70, points: 2.33 },
      { letter: "C", minPercent: 65, points: 2.0 },
      { letter: "C-", minPercent: 60, points: 1.67 },
      { letter: "D+", minPercent: 55, points: 1.33 },
      { letter: "D", minPercent: 50, points: 1.0 },
      { letter: "F", minPercent: 0, points: 0 },
    ],
  },
  {
    id: "us-4.0",
    name: "US 4.0 (common convention)",
    description: "A typical US letter scale. Many schools differ; edit it to match yours.",
    rounding: "none",
    maxPoints: 4,
    bands: [
      { letter: "A", minPercent: 93, points: 4.0 },
      { letter: "A-", minPercent: 90, points: 3.7 },
      { letter: "B+", minPercent: 87, points: 3.3 },
      { letter: "B", minPercent: 83, points: 3.0 },
      { letter: "B-", minPercent: 80, points: 2.7 },
      { letter: "C+", minPercent: 77, points: 2.3 },
      { letter: "C", minPercent: 73, points: 2.0 },
      { letter: "C-", minPercent: 70, points: 1.7 },
      { letter: "D+", minPercent: 67, points: 1.3 },
      { letter: "D", minPercent: 60, points: 1.0 },
      { letter: "F", minPercent: 0, points: 0 },
    ],
  },
  {
    id: "simple-4.0",
    name: "Simple 4.0 (A–F)",
    description: "Five whole letters: A 90, B 80, C 70, D 60.",
    rounding: "none",
    maxPoints: 4,
    bands: [
      { letter: "A", minPercent: 90, points: 4 },
      { letter: "B", minPercent: 80, points: 3 },
      { letter: "C", minPercent: 70, points: 2 },
      { letter: "D", minPercent: 60, points: 1 },
      { letter: "F", minPercent: 0, points: 0 },
    ],
  },
];

export interface InstitutionPreset {
  id: string;
  name: string;
  shortName: string;
  country: string;
  timezone: string;
  gradingPresetId: string;
  periodSystem: "trimester" | "semester" | "quarter" | "custom";
  degreeLevel: "bachelor" | "master" | "doctorate" | "diploma" | "certificate" | "other";
  programName: string;
  major: string;
}

export const INSTITUTION_PRESETS: InstitutionPreset[] = [
  {
    id: "aitu",
    name: "Astana IT University",
    shortName: "AITU",
    country: "KZ",
    timezone: "Asia/Almaty",
    gradingPresetId: "kz-4.0",
    periodSystem: "trimester",
    degreeLevel: "bachelor",
    programName: "BSc Software Engineering",
    major: "Software Engineering",
  },
];

export const PERIOD_SYSTEMS = [
  { value: "trimester", label: "Trimesters (3 per year)", count: 3 },
  { value: "semester", label: "Semesters (2 per year)", count: 2 },
  { value: "quarter", label: "Quarters (4 per year)", count: 4 },
  { value: "custom", label: "Custom (1 period to start)", count: 1 },
] as const;

export function periodNames(system: "trimester" | "semester" | "quarter" | "custom", count: number): string[] {
  const label = system === "trimester" ? "Trimester" : system === "semester" ? "Semester" : system === "quarter" ? "Quarter" : "Period";
  return Array.from({ length: count }, (_, i) => `${label} ${i + 1}`);
}

export function getGradingPreset(id: string): GradingPreset | undefined {
  return GRADING_PRESETS.find((p) => p.id === id);
}
