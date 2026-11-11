# Integration feasibility (AITU LMS, EDUS)

**Rule followed:** no invented APIs, no scraping, no bypassing authentication, and the app never asks for a university password.

## Findings (from public web research during this milestone)

| Platform | What was found | Verified API? | Status |
|---|---|---|---|
| AITU LMS (`lms.astanait.edu.kz` was requested) | A 2020 AITU student guide describes a **Moodle**-based LMS (at `moodle.astanait.edu.kz` at the time). Moodle can expose REST web services using per-user tokens **if the university's administrators enable them** and publish functions. No AITU-specific API documentation or token policy was found. | **No** | **Blocked on the university**: ask IT whether web services are enabled and whether students may generate tokens. Until confirmed, nothing is connected. |
| EDUS.kz | EDUS appears to be a **school** information system (Mektep.EDUS). No public developer documentation was found. | **No** | **Not connected.** Likely not applicable to university LMS data. |

The live LMS pages themselves were **not** inspected (no authorised session; unauthenticated probing would not answer the API question).

## What exists instead

- Manual entry for everything (courses, assessments, grades, timetable, tasks).
- Syllabus/material upload with extraction.
- Assessment rows carry an `origin` field (`manual`, `syllabus`, `csv`, `xlsx`, `ics`, `lms`, `screenshot`) and `imported_at`, so any future import is visibly labelled.
- Settings → "Integrations & AI — honest status" shows the real state of each integration.

## Planned (not built)

1. **ICS calendar import** (standards-based, no credentials) and **CSV/XLSX grade/assessment import** with a preview-and-approve step like the syllabus flow.
2. **Provider-independent sync layer** (`integrations`, `sync_logs` tables) once a verified source exists; show "last synced".
3. If AITU enables Moodle web services: a token-based adapter (token entered by the user, stored encrypted, read-only scope), tested against a real account.
4. **Grade screenshot import** via a vision-capable provider with per-value confirmation — blocked on a configured and verified AI provider.
