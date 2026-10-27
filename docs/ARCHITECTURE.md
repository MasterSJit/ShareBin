# Architecture

## Overview

ShareBin is a single Next.js 16 (App Router) application:

```
Browser (single-page client, hash routing)
   │  fetch /api/*  (JSON envelope)        GET /p/<slug>, /raw/<slug>
   ▼
src/proxy.ts ── API-key rate limit, API on/off, CORS   (only /api/*)
   │
Route handlers (src/app/api/**/route.ts)
   │  getSession() ── cookie or API key, re-validated against the DB
   │  checkPasteAccess() ── expiry → private → password
   ▼
Prisma ──► SQLite (prisma/db/custom.db)          Local storage (./storage)
```

There is no separate backend; route handlers are the API. In-memory state
(rate limits, short caches) lives in the Node process — see
[Scaling](#scaling-notes).

## Frontend

- `src/app/page.tsx` renders the whole app client-side. `src/lib/store.ts`
  (Zustand) maps the URL hash to a view:

  | Hash | View |
  |---|---|
  | `#/` | Create (home) |
  | `#/browse` | Browse public pastes |
  | `#/p/<slug>` | Paste view |
  | `#/dashboard` | Dashboard |
  | `#/admin` | Admin panel |
  | `#/login`, `#/register` | Auth |
  | `#/reset?token=…` | Password reset from an emailed link |

  `pushState` keeps Back/Forward working. `/p/<slug>` is a server route that
  redirects to `/#/p/<slug>` so share links look clean.
- `src/lib/api-client.ts` is the typed client. It unwraps the envelope, throws
  `ApiError(status, message)`, and remembers paste unlock tokens.
- UI: Tailwind CSS 4 + shadcn/ui; Monaco editor (`components/editor/code-editor.tsx`,
  loaded client-side only); Framer Motion and GSAP for animation.

## Data model

`prisma/schema.prisma` (SQLite; enum-like fields are strings validated in code).

| Model | Purpose |
|---|---|
| `User` | Account. `role` is a denormalised copy of `roleRef.name`; `sessionVersion` invalidates sessions; `apiKey` |
| `Paste` | Text or file paste: `slug`, `contentType`, `textContent` or `storageKey`/`mimeType`/`fileSizeBytes`, `visibility`, `passwordHash`, `burnAfterRead`/`isBurned`, `expiresAt`, `isFlagged`, `viewCount` |
| `PasteAccessGrant` | Extra users allowed to read a private paste |
| `PasswordResetToken` | SHA-256 of a reset token, expiry |
| `Role`, `Permission`, `RolePermission` | RBAC |
| `Plan`, `Subscription`, `UsageRecord` | Plans, assignments, cached usage counters |
| `Payment`, `Invoice` | Manually recorded payments and generated invoices |
| `Ad` | Ad slots with impression/click counters |
| `AuditLog` | Actor (`adminId`, null = system), action, target, JSON metadata |
| `SiteSetting` | Key → JSON value; defaults live in `lib/paste-utils.ts` (`SETTING_DEFAULTS`) |

Deletion is **hard** everywhere (expiry, burn, owner, admin): the record, its
file and its access grants are removed by `lib/cleanup.ts → hardDeletePaste`.
The `isDeleted` column is legacy and always `false`.

## Authentication — `lib/auth.ts`

- **Session**: `ps_session` cookie = base64url(JSON payload) + HMAC-SHA256
  (`SESSION_SECRET`). Payload: `userId`, `email`, `role`, `exp`, `v`.
- `getSession()` verifies the signature, then loads the user (cached 5 s) and
  rejects banned/suspended users and tokens whose `v` ≠ `User.sessionVersion`.
  The returned `role` is the **current** DB role.
- `bumpSessionVersion()` runs on password change/reset and on ban/suspend, so
  existing cookies stop working immediately.
- **API keys**: when there is no valid cookie, `getSession()` accepts
  `x-api-key` / `Authorization: Bearer ps_…`. `src/proxy.ts` applies the
  per-key rate limit and the `apiEnabled` switch before the route runs.

## Paste access — `lib/paste-access.ts`

`checkPasteAccess(req, paste, session)` is the single gate used by every read
path (JSON, raw, file, zip):

1. **Expired** → hard-delete, `410`. **Burned** → `410`.
2. **Private** → owner, moderator (`admin` role or `admin:content`), or a
   `PasteAccessGrant`; otherwise `401`/`403`.
3. **Password** → owners/moderators skip it; others need a valid unlock token
   (cookie `ps_ul_<id>`, `x-unlock-token`, `?token=`) or `x-paste-password`.

Unlock tokens are `"<expiryMs>.<hmac(pasteId:expiry:passwordHash)>"` — bound to
the paste and to its current password hash, valid one hour.

### Reading a paste (`lib/paste-read.ts`)

```
peek=1 ─────────────► metadata only (UI uses this first)
file paste ─────────► metadata (+1 view unless burn-pending)
burn pending ───────► claimBurn() → content once → scheduleBurnDelete()
otherwise ──────────► content (+1 view unless owner/moderator)
```

`claimBurn()` is `UPDATE … WHERE id = ? AND isBurned = false`; only the request
that flips the flag gets the content, so concurrent readers can't both see it.
The row and file are deleted a second later (and by the cleanup cron as a
fallback).

The UI flow for burn pastes: peek → "this will self-destruct" screen → reveal.
For burn files the browser downloads the bytes once with `fetch`, saves them,
and previews from a `blob:` URL.

### Serving files (`app/api/file/route.ts`)

- `inline=1` renders only safe types inline; text is always sent as
  `text/plain`; every response has `nosniff` and (except PDF) a sandboxing CSP.
- `Range` requests read slices via `StorageProvider.readRange` (video seeking).
- ZIP archives are read by `lib/zip.ts`: only the end-of-central-directory and
  central directory are read to list entries; single entries are inflated with
  `zlib.inflateRawSync` (50 MB cap).

## Creating content — `lib/paste-create.ts`

`validateCreateOptions()` normalises visibility/password/burn/expiry against the
caller's plan (`lib/rbac.ts → getUserLimits`; guests get `FREE_LIMITS`). Text
and file creation then check size, spam rules (`lib/security-scan.ts`), rate
limits, monthly quota and (files) storage quota, write the paste and refresh the
user's `UsageRecord`.

Slugs are 8 base62 characters from `crypto.randomBytes` with rejection sampling.

## Plans and usage — `lib/rbac.ts`

- Effective limits: active subscription's plan → the `Free` plan → `FREE_LIMITS`
  (guests).
- `UsageRecord` caches counts for display; `recomputeUsage()` refreshes it after
  every create/delete. The storage check aggregates live file sizes.
- Monthly counters reset lazily on first access in a new month.

## Caching — `lib/cache.ts`

| Key | TTL | Notes |
|---|---|---|
| `paste:<id|slug>:meta` | ≤ 30 s | full paste row; invalidated on every write |
| `user:<id>:auth` | 5 s | auth fields for `getSession`; cleared on admin edits |
| settings map | 5 s | `getSettings()`; cleared on writes |
| rate-limit buckets | sliding window | login, register, create, upload, unlock, report, reset |

A sweeper drops expired entries every 5 minutes.

## Background work

- `/api/cron/cleanup` and `/api/cron/subscriptions` (protected by
  `CRON_SECRET`).
- Listing requests also trigger `maybeRunCleanup()` at most once a minute.

## Scaling notes

The app is designed for a single Node process:

- caches and rate limits are per process — behind a load balancer, use sticky
  sessions or move them to Redis;
- SQLite is a single file — for multiple app servers switch the Prisma
  datasource to PostgreSQL/MySQL (string enums keep the schema portable);
- local storage is a single directory — implement `StorageProvider` for S3 in
  `lib/storage.ts` (the interface is already abstracted, including `readRange`).
