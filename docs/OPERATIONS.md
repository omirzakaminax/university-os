# Operations: security, privacy, backup & recovery

## Security status

| Control | Status |
|---|---|
| Authentication (hashing, sessions, reset, rate limits) | Implemented + tested (local provider) |
| Authorisation = Row Level Security + composite ownership keys | Implemented + tested against real Postgres incl. direct API requests |
| Input validation (zod everywhere), safe error envelope, no stack traces | Implemented |
| CSRF (Origin check for cookie-authenticated mutations; Server Actions are origin-checked by Next) | Implemented + tested |
| Security headers (nosniff, frame-ancestors none, referrer, permissions) | Implemented. **No script-src CSP yet** (needs nonces for Next inline scripts) — planned |
| Upload safety: magic-byte sniffing, size cap, filename sanitising, SHA-256 dedupe, attachment-only downloads with sandbox CSP | Implemented + unit/DB/e2e tested |
| Prompt-injection mitigation for AI | Delimited data + instruction, schema validation, evidence verification, no tool execution — mitigation only |
| Audit log (append-only) | Implemented for key actions |
| Rate limiting | Per-process memory (auth, API, uploads). **Needs a shared store for multi-instance** |
| Secrets | Env vars only; `.env.local` ignored; service/admin DB URL never reaches the client |
| Password reset by email, MFA, email verification | **Not implemented** |
| Dependency/vulnerability scanning in CI | **Not set up** |

### Known risks / limitations

- Session cookie name and the local auth provider are not a managed identity service; no MFA, no email verification, registration reveals whether an email exists (rate-limited).
- PDF/DOCX parsing runs in the web process (no sandbox/timeouts beyond size limits); a malicious document could consume CPU/memory. Move extraction to a worker with limits before opening registration publicly.
- Files live in Postgres: backups contain user documents (treat backups as sensitive).
- The Gemini adapter is unverified against the live API and its free tier may train on submitted content (consent gate + warning exist).
- The in-process rate limiter resets on restart.

## Privacy & compliance

- Private by default; nothing is shared; no public links exist. IDs are random UUIDs.
- Export: Settings → *Export my data* (`GET /api/v1/me/export`) gives a JSON file of all structured data. Binary files are downloaded per document; a bundled ZIP export is planned. (`EXPORT_EXCLUDED` in `src/server/services/export.ts` documents what is not in the JSON, enforced by a test.)
- Deletion: Settings → *Delete account* removes the user and **every row** via `ON DELETE CASCADE` (verified by test for all user-owned tables).
- AI: no content leaves the server unless the user opts in; no model training by this app.
- **Kazakhstan personal-data law** (Law "On Personal Data and its Protection") obligations — consent, localisation/cross-border transfer rules, breach notification — have **not** been researched or satisfied. Do this before any public launch.

## Backup & recovery

All durable state is in PostgreSQL.

- **Self-managed:** `pg_dump -Fc "$DATABASE_ADMIN_URL" > uos-$(date +%F).dump`; restore with `createdb restored && pg_restore -d restored uos-….dump`. Includes files (bytea) and auth tables — store encrypted.
- **Supabase:** use the project's backups (note: free plan has limited/no point-in-time recovery *(verify)*) and still take your own `pg_dump` periodically.
- **Per user:** the JSON export + each document download is a portable personal backup.
- **Restore test:** the test suite rebuilds the whole schema from migrations on every run, so the migration set is known to reproduce an empty database; a restore-from-dump drill has **not** been automated.
- Migrations are forward-only SQL; never run `db:reset` against anything but a local/test database (it refuses without `LOCAL_SHIM=1`).
