# Costs, free tiers and limits

Goal: run for **0 USD** as a personal/student project, and never silently depend on something that bills.
Figures marked *(verify)* come from third-party summaries found while researching and **must be checked on the official pricing page before relying on them**; the sandbox used to build this could not reach Google's documentation.

| Service | Used for | Cost today | Limits / catch | If the limit is hit |
|---|---|---|---|---|
| Next.js, React, Tailwind, Postgres drivers, unpdf, mammoth, Recharts, cmdk, Radix | App | Free (open source) | — | — |
| Local PostgreSQL | Dev/test | Free | — | — |
| **Supabase** (not exercised yet) | Hosted Postgres/Auth/Storage | Free plan | *(verify)* ~2 active projects, **500 MB DB**, 1 GB file storage, ~50k MAU, **free projects pause after ~1 week of inactivity** | Writes fail near DB cap → export data (Settings → Export) and prune old documents; a paused project must be resumed from the dashboard. Files are stored in the DB today, so heavy uploads reach the cap first |
| **Google Gemini API** (optional) | Syllabus AI analysis (more later) | Free tier exists | *(verify)* per-model quotas are not reliably published (reportedly only visible in AI Studio); **free-tier content may be used to improve Google products** → app requires explicit consent and warns; some models are not on the free tier | HTTP 429 → user sees "quota used up" and the app falls back to the free rules-based extractor. Local cap `AI_DAILY_REQUEST_LIMIT` (default 30/user/day) protects the quota. Cost is never estimated — the ledger stores NULL |
| Email provider | Password reset, alerts | **Not integrated** | — | Reset links are not emailed (dev-only on-screen link). Needs an SMTP/transactional provider (many have free tiers; none chosen) |
| Hosting (Vercel/Render/…) | Production | **Not chosen** | Free tiers exist but have limits on request duration and memory (PDF parsing, 15 MB uploads) | Choose before launch; document here |
| Background jobs / vector DB / analytics | — | **Intentionally avoided** | — | FTS in Postgres instead of a vector DB; lazy notification generation instead of a paid scheduler |

## Cost-control features that exist now

- AI is **optional**; every core feature works without a key (tested: the whole syllabus flow runs on the rules path).
- Explicit per-user **consent** before any content is sent to a provider.
- **Daily request limit** per user + usage ledger (requests and tokens).
- **Caching:** identical files are never re-processed (SHA-256), and a draft analysis for the same document is reused instead of calling the model again.
- Small/cheap model tier for extraction (`GEMINI_MODEL_FAST`); a "smart" tier is configurable for future tutoring.
- AI failures degrade to the rules-based path rather than blocking the user.

## Before launch

Verify current Gemini terms/quotas and Supabase limits on the official pages; decide hosting and an email provider; re-check data-protection obligations (docs/OPERATIONS.md).
