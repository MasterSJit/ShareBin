# Changelog

## 1.0.0 — review & hardening release

### Upgrade notes

- Run `bun run db:push` (back up `prisma/db/custom.db` first). Adds
  `User.sessionVersion`, the `PasswordResetToken` table, and makes
  `AuditLog.adminId` nullable (system actions). Existing data is kept and
  users stay signed in.
- Visitors re-enter paste passwords once (the old `x-unlocked` header is gone).
- New optional env vars: `CRON_SECRET`, `PRISMA_LOG_QUERIES`,
  `ALLOW_INSECURE_RESET_TOKENS`, `INSECURE_COOKIES` — see `.env.example`.

### Security fixes

See [docs/SECURITY.md](docs/SECURITY.md#issues-fixed-in-this-release) for details.

- Password-protected pastes could be read by anyone via a forged `x-unlocked` header.
- `GET /api/user/<id>` leaked any user's email and API key without login.
- Forgot-password returned the reset token in the response (account takeover).
- Bans, role changes and password changes didn't affect existing sessions.
- Raw endpoint ignored burn-after-read; concurrent readers could both read a burn paste.
- Files served without `nosniff`/CSP; text uploads now always render as plain text.
- Audit log stored password hashes and secret settings.
- Search could reveal content of password-protected pastes; listings exposed owner emails.
- Cron endpoints were public; slugs used `Math.random()`; unlimited password guessing.

### Bug fixes

- **Burn-after-read pastes burned themselves**: after creating one, the app
  opened it immediately — the creator was the first reader.
- **Burn-after-read files were deleted before they could be downloaded**
  (opening the page burned them, then the download returned 410).
- **Password-protected files never previewed or downloaded**: two password
  prompts, the second sent the slug instead of the id, and `<img>`/`<video>`
  can't send custom headers.
- **The spam scanner rejected most code**: any `#`, `--` or `/*`, `onX = …` or
  `exec(` counted as an attack, blocking Python, Markdown, SQL, CSS, C…
  These signatures are now opt-in (`spamScanStrict`).
- **API keys didn't work at all** — the documented `x-api-key` auth was never wired
  into any route. Admin API settings (on/off, rate limit, CORS) now apply too.
- Listing pagination returned empty or duplicated pages after page 1; the
  language filter hid pastes that had any expiry.
- Storage quota was never enforced (usage counter never updated).
- Logged-in users on plans without file uploads could still upload.
- Editing a paste ignored plan limits (private, password, burn, expiry).
- Deleting an account or a user (admin) left their pastes behind as anonymous
  guest pastes, although the UI promised they'd be deleted; deleting an admin
  with audit history failed.
- `/api/admin/paste/[id]` DELETE soft-deleted (record stayed, file removed).
- Renaming a role left users' role names stale (renaming `admin` locked admins
  out); deleting a role left its name on users.
- Deleting a plan with payments failed with a database error.
- Share button copied only the slug instead of a link.
- Ad clicks were counted twice.
- Site settings `maxFileSizeBytes`, `allowedFileTypes`, `bannedFileExtensions`
  and `defaultExpiry` were ignored.
- Monaco had no highlighting for `bash`, `jsx`, `tsx`; a duplicate
  "Auto-detect" language entry did nothing.
- Paste cards never showed content previews (the API didn't send any).
- Forgot-password form was nested inside the login form (invalid HTML).
- Demo admin credentials were shown on the login page in production.
- Page title read "ShareBin — ShareBin".
- Prisma logged every SQL query; in-memory view counter grew forever.

### New features

- Share dialog after creating (link, raw link, burn/password reminders).
- Clean URLs: `/p/<slug>` and `/raw/<slug>`.
- Burn-after-read confirmation screen; owners can view their own burn pastes
  without burning them; burn files download once and preview from memory.
- Multi-file uploads with progress; paste images from the clipboard.
- ZIP archive browser with single-file extraction (`/api/file/zip`).
- Video/audio seeking (HTTP Range).
- Markdown rendering for Markdown pastes.
- Automatic language detection; Ctrl/⌘ + Enter to submit; line/char/byte counter
  with the plan limit.
- Owner editing of content and metadata from the paste page; Clone; Download
  as a file with the correct extension; Report abuse.
- Dashboard: plan & usage card, search, load more, API key copy/revoke and a
  ready-made `curl` command; edit dialog with a clear "keep current" expiry.
- CLI-friendly creation: plain-text bodies, `?format=url`, `POST` alias.
- `x-paste-password` header for scripted access to protected pastes.
- Moderators (`admin:content`) can moderate through the API; audit-log filters.
- `GET /api/health`; `X-Total-Count` on listings; reset-password links
  (`#/reset?token=…`); registration on/off setting; mail hook (`lib/mailer.ts`).

### UI & layout

- Header and footer now share the page width, so their edges line up with the
  content; the back button aligns with the page edge.
- Create-panel tabs show only the underline (no stray box in dark mode).
- Browse: equal-height cards, single-line card footers, visible search
  placeholder with correct icon spacing, readable language names, full-width
  filter buttons on phones.
- Dashboard: Edit/Delete moved inside each card; profile and plan cards sit
  side by side on tablets; the plan card no longer drifts far down the column.
- Admin: left-aligned sidebar navigation (sticky on desktop), consistent
  active state, responsive tab grid on small screens.
- Paste page: icon-only action bar on phones; auth card vertically centred;
  editor minimap hidden on narrow screens; window chrome shows the site name.

### Docs

- Rewritten README; new `docs/API.md`, `docs/ARCHITECTURE.md`,
  `docs/SECURITY.md`, `docs/DEPLOYMENT.md`; `.env.example`; updated `/api/docs`.
