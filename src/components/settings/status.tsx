import { Badge, Card, CardHeader } from "@/components/ui/card";

type Tone = "success" | "warning" | "neutral" | "danger";
const ROWS: { name: string; status: string; tone: Tone; detail: string }[] = [
  { name: "AI tutor & briefing", status: "Not built yet", tone: "neutral", detail: "Planned for the AI-learning milestone. Optional syllabus analysis exists (Gemini adapter, unverified against the live API). The tutor and briefing are not built. Keys stay on the server." },
  { name: "AITU LMS", status: "No official API verified", tone: "warning", detail: "AITU’s published student guide describes a Moodle-based LMS, but no public web-service API or sign-in method for third-party apps was found. University OS will never ask for or store your university password. Planned alternatives: CSV / XLSX / ICS import and manual entry." },
  { name: "EDUS.kz", status: "No public API documentation found", tone: "warning", detail: "EDUS is a school information system and no public developer documentation was found. Nothing is connected. Manual entry and file imports are the supported route." },
  { name: "Email notifications & university email", status: "Not configured", tone: "neutral", detail: "No email provider is configured, so password-reset emails and email alerts are unavailable. Sending an email will always require your explicit approval once an integration exists." },
  { name: "Browser / PWA notifications", status: "Planned", tone: "neutral", detail: "In-app notifications work today. Push notifications arrive with the PWA milestone." },
];

export function IntegrationStatus() {
  return (
    <Card id="integrations">
      <CardHeader title="Integrations & AI — honest status" description="Nothing here is simulated. If it says not connected, it is not connected." />
      <ul className="divide-y divide-line px-4 py-1">
        {ROWS.map((r) => (
          <li key={r.name} className="py-3">
            <div className="flex items-center justify-between gap-3"><p className="text-[13px] font-medium">{r.name}</p><Badge tone={r.tone}>{r.status}</Badge></div>
            <p className="mt-1 text-xs text-subtle">{r.detail}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
