# PasteShare — Software Documentation

**Temporary File & Text Sharing Platform with Syntax Highlighting, Expiry, Privacy & Admin Controls**

Version: 1.0
Document Type: Technical & Functional Specification

---

## 1. Project Overview

PasteShare is a Pastebin-style web application that lets users share **text/code snippets** (with full syntax highlighting via Monaco Editor) and **files** (any type) through shareable links. Shares support auto-expiry, password protection, burn-after-read, and private (login-required) visibility. The platform supports pluggable storage backends (Local disk / AWS S3), caching for performance, email-verified authentication, and a full admin panel for managing users, pastes/files, SEO, and site configuration.

### 1.1 Core Goals
- Full feature parity with Pastebin, plus file uploads.
- Fast read/write performance via caching.
- Flexible storage (local dev, S3 production).
- Strong access control (public, unlisted, private, password, burn-after-read).
- Admin oversight of all content and settings.

---

## 2. Feature List

### 2.1 Paste / File Creation
- Create text paste with language selection (auto-detect + manual override) using **Monaco Editor**.
- Upload a file directly (any MIME type) as an alternative to text paste.
- Optional title, description, and tags.
- Syntax highlighting for 100+ languages (via Monaco's built-in language modes).
- Line numbers, word wrap toggle, theme toggle (light/dark) in editor.
- Guest (anonymous) pastes allowed for public/unlisted visibility.

### 2.2 Visibility & Access Control
| Type | Description |
|---|---|
| Public | Listed in recent/public pastes, indexed for SEO |
| Unlisted | Accessible only via direct link, not listed |
| Private | Requires the viewer to be logged in; owner controls who/if others can view |
| Password Protected | Requires a password (hashed, never stored in plain text) to view |
| Burn After Read | Deleted permanently after the first successful view |

- Private visibility requires the **creator** to be logged in at creation time.
- Password protection can be combined with any visibility type except burn-after-read (burn-after-read implicitly locks after one view regardless).

### 2.3 Expiry
- Options: Never, 10 minutes, 1 hour, 1 day, 1 week, 1 month, 1 year, Custom date/time.
- Expired content is soft-deleted immediately and hard-deleted by a scheduled cleanup job (cron/worker).
- Burn-after-read overrides expiry — deletion happens on first view or at expiry, whichever comes first.

### 2.4 Storage Backends
Pluggable storage layer supporting:
- **Local Disk** — for self-hosted/dev environments, files under a configurable root directory.
- **AWS S3 (or S3-compatible: MinIO, Cloudflare R2, DigitalOcean Spaces)** — for production, using presigned URLs for direct upload/download where possible.

Storage choice is a **site-wide admin setting**, not per-user (admin can migrate between backends via a background job).

### 2.5 Caching
- Redis (or compatible) cache layer for:
  - Rendered/highlighted paste content (avoids re-processing Monaco tokenization data on every request).
  - Metadata lookups (visibility, expiry, owner) to avoid DB hits on every view.
  - Rate-limiting counters (view counts, abuse prevention).
  - Session/token blacklists.
- Cache invalidation on edit, delete, or expiry.
- Optional CDN edge caching for public paste pages (SEO-relevant, non-private only).

### 2.6 Authentication
- Register with email + password.
- Email verification required before full account access (magic link or 6-digit OTP).
- Login with email/password; optional "remember me" (refresh token in httpOnly cookie).
- Forgot password / reset password flow (time-limited token).
- JWT (access + refresh token) or session-based auth — see §5.3.
- Rate-limited login attempts (brute-force protection).

### 2.7 User Dashboard
- List of own pastes/files with status (active, expired, burned, private).
- Edit/delete/extend-expiry on own content.
- View count per paste.
- Personal API key generation (for programmatic paste creation, Pastebin-API-style).

### 2.8 Admin Panel
- **User management**: list, search, ban/suspend, verify manually, delete, view activity, impersonate (support mode).
- **Content management**: browse/search all pastes & files, force-delete, force-expire, flag/unflag abusive content.
- **Site settings**: site name, logo, default expiry, max file size, allowed file types, storage backend config, SMTP config, feature toggles (e.g., disable guest posting).
- **SEO settings**: meta title/description templates, sitemap.xml generation toggle, robots.txt editor, per-page canonical URL overrides, Open Graph defaults.
- **Analytics dashboard**: total pastes, total users, storage usage, top languages used, traffic over time.
- **Audit log**: admin actions are logged (who deleted what, when).

### 2.9 Public/API Features (Pastebin parity)
- Public "Recent Pastes" listing page.
- Trending/most-viewed pastes.
- Archive/browse by language.
- Raw view endpoint (`/raw/:id`) returning plain text.
- Embed snippet generator (iframe/JS embed for a paste).
- REST API with API-key auth for creating pastes programmatically.
- Direct "Download" for file-type shares.

---

## 3. Recommended Frontend Framework: React vs Vue

### 3.1 Recommendation: **React** (with Next.js)

| Criteria | React (Next.js) | Vue (Nuxt) |
|---|---|---|
| Monaco Editor integration | First-class via `@monaco-editor/react`, most mature, most examples/community support | Works via `vue-monaco` / manual wrapper, smaller community, more manual wiring |
| SEO (public pastes need indexing) | Next.js SSR/ISR is best-in-class, mature `next-sitemap`, metadata API | Nuxt SSR is good but ecosystem for meta/SEO plugins is smaller |
| File upload UI ecosystem (dropzones, progress bars, S3 presigned upload widgets) | Very large ecosystem (`react-dropzone`, `uppy` has strong React bindings) | Smaller, though Uppy also supports Vue |
| Admin panel component libraries | Extremely broad (MUI, Ant Design, shadcn/ui, Chakra) | Smaller but solid (Vuetify, PrimeVue) |
| Hiring/community/long-term support | Larger talent pool, more Stack Overflow/GitHub answers for edge cases | Smaller but growing, excellent DX |
| Learning curve | Steeper (hooks, more boilerplate) | Gentler, more "batteries-included" |

**Verdict:** Go with **React + Next.js (App Router)**. The dominant reason is Monaco Editor's official React bindings are more mature and better documented, and Next.js's SSR/ISR + metadata API directly serves the SEO requirement for public pastes — which is a stated core feature. Vue/Nuxt is a perfectly viable second choice if the team already has stronger Vue expertise; functionally either can deliver 100% of the feature set.

---

## 4. Technology Stack

| Layer | Technology |
|---|---|
| Frontend Framework | React 18+ with Next.js 14+ (App Router) |
| Code Editor | Monaco Editor (`@monaco-editor/react`) |
| Styling/UI | Tailwind CSS + shadcn/ui (or Ant Design for faster admin build) |
| Backend Runtime | Node.js (Next.js API routes / Route Handlers, or standalone Express/Fastify service) |
| ORM | **Drizzle ORM** |
| Database | PostgreSQL (recommended) — Drizzle supports MySQL/SQLite too if preferred |
| Cache | Redis |
| Storage | Local Filesystem + AWS S3 (via `@aws-sdk/client-s3`), abstracted behind a `StorageProvider` interface |
| Auth | Custom JWT/session auth (or Lucia Auth / Auth.js adapted for Drizzle) |
| Email | Nodemailer + SMTP, or transactional provider (Resend / SES / Postmark) |
| Background Jobs | BullMQ (Redis-backed) for expiry cleanup, email sending, S3 migrations |
| Deployment | Docker + Docker Compose (App, Postgres, Redis, optionally MinIO for local S3 testing) |

---

## 5. Architecture

### 5.1 High-Level Diagram (described)
```
[Browser: Next.js React App]
        |
        | HTTPS
        v
[Next.js Server / API Layer]
   |        |         |          |
   v        v         v          v
[Auth]  [Paste/File] [Admin]  [Storage
Service  Service      Service  Provider]
   |        |         |          |
   v        v         v          v
[Postgres via Drizzle ORM]   [Local Disk / S3]
        |
        v
     [Redis Cache + BullMQ Queue]
```

### 5.2 Storage Abstraction Layer
A common interface decouples business logic from the storage backend:

```ts
interface StorageProvider {
  upload(key: string, data: Buffer | Readable, mimeType: string): Promise<string>; // returns storage path/URL
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
  download(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
}
```
- `LocalStorageProvider` writes under `STORAGE_LOCAL_ROOT/{yyyy}/{mm}/{uuid}`.
- `S3StorageProvider` uses presigned PUT URLs for direct browser-to-S3 upload (bypassing the app server for large files) and presigned GET URLs for downloads.
- Admin setting `STORAGE_DRIVER=local|s3` controls which is active; switching triggers an optional migration job.

### 5.3 Auth Flow
1. **Register** → create `users` row (`status = pending_verification`) → send verification email (JWT or OTP, 15–30 min expiry).
2. **Verify** → `/verify?token=...` → sets `status = active`, `email_verified_at = now()`.
3. **Login** → validate credentials → issue **access token** (short-lived, 15 min, JWT) + **refresh token** (httpOnly cookie, 7–30 days, rotated).
4. **Protected routes** check access token; refresh silently via refresh endpoint when expired.
5. **Private paste access** requires a valid session; ownership or explicit share-grant checked per request.
6. Passwords hashed with **argon2** (preferred) or bcrypt (cost ≥ 12).

### 5.4 Caching Strategy
- Cache key pattern: `paste:{id}:meta`, `paste:{id}:content`, `user:{id}:pastes`.
- Read-through cache: on paste view, check Redis → fallback to Postgres → populate cache with TTL = min(remaining expiry, 1 hour).
- Write-through invalidation: on edit/delete/burn, immediately `DEL` the relevant keys.
- View counters use Redis `INCR` and are periodically flushed to Postgres (every N seconds via BullMQ job) to avoid write amplification.

---

## 6. Database Schema (Drizzle ORM)

> PostgreSQL dialect shown; adjust types slightly if targeting MySQL/SQLite.

```ts
// db/schema.ts
import {
  pgTable, uuid, varchar, text, boolean, timestamp, integer,
  bigint, pgEnum
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const userStatusEnum = pgEnum("user_status", ["pending_verification", "active", "suspended", "banned"]);
export const visibilityEnum = pgEnum("visibility", ["public", "unlisted", "private"]);
export const contentTypeEnum = pgEnum("content_type", ["text", "file"]);
export const storageDriverEnum = pgEnum("storage_driver", ["local", "s3"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 100 }),
  role: userRoleEnum("role").notNull().default("user"),
  status: userStatusEnum("status").notNull().default("pending_verification"),
  emailVerifiedAt: timestamp("email_verified_at"),
  apiKey: varchar("api_key", { length: 64 }).unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const emailVerifications = pgTable("email_verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const passwordResets = pgTable("password_resets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
});

export const pastes = pgTable("pastes", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }), // null = guest
  title: varchar("title", { length: 255 }),
  slug: varchar("slug", { length: 20 }).notNull().unique(), // short shareable code
  contentType: contentTypeEnum("content_type").notNull().default("text"),
  language: varchar("language", { length: 50 }).default("plaintext"),
  textContent: text("text_content"), // used when contentType = text
  storageDriver: storageDriverEnum("storage_driver"), // used when contentType = file
  storageKey: varchar("storage_key", { length: 500 }), // path/key in the storage backend
  originalFileName: varchar("original_file_name", { length: 255 }),
  mimeType: varchar("mime_type", { length: 100 }),
  fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
  visibility: visibilityEnum("visibility").notNull().default("public"),
  passwordHash: varchar("password_hash", { length: 255 }), // null if not password protected
  burnAfterRead: boolean("burn_after_read").notNull().default(false),
  isBurned: boolean("is_burned").notNull().default(false),
  viewCount: integer("view_count").notNull().default(0),
  expiresAt: timestamp("expires_at"), // null = never
  isDeleted: boolean("is_deleted").notNull().default(false),
  isFlagged: boolean("is_flagged").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const pasteAccessGrants = pgTable("paste_access_grants", {
  id: uuid("id").primaryKey().defaultRandom(),
  pasteId: uuid("paste_id").notNull().references(() => pastes.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  grantedAt: timestamp("granted_at").notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: uuid("admin_id").notNull().references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(), // e.g. "delete_paste", "ban_user"
  targetType: varchar("target_type", { length: 50 }).notNull(),
  targetId: varchar("target_id", { length: 100 }).notNull(),
  metadata: text("metadata"), // JSON string
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const siteSettings = pgTable("site_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull(), // JSON string for flexibility
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

**Indexing notes:**
- Index `pastes.slug` (unique, already covered), `pastes.ownerId`, `pastes.expiresAt` (for the cleanup job scan), `pastes.visibility`.
- Partial index on `pastes` where `is_deleted = false AND visibility = 'public'` speeds up the public listing page.

---

## 7. API Design Convention

### 7.1 Standard Response Envelope

Every API response — success or error — uses the **same fixed shape**. `data` is **always an array**, even for a single-object result (single object is wrapped as a one-element array) or when there is nothing to return (`[]`).

```json
{
  "message": "created successfull",
  "data": []
}
```

Examples:

```json
// Single user fetched
{ "message": "user fetched successfully", "data": [ { "id": "u_123", "email": "a@b.com" } ] }

// List of users
{ "message": "users fetched successfully", "data": [ { "id": "u_123" }, { "id": "u_124" } ] }

// Create success, nothing meaningful to return beyond the new record
{ "message": "created successfull", "data": [ { "id": "u_125" } ] }

// Delete success — data is an empty array, not null/omitted
{ "message": "user deleted successfully", "data": [] }

// Validation error
{ "message": "email is required", "data": [] }
```

**Rule:** `data` is never `null`, never a bare object, never omitted — always `[]` or `[ ...items ]`. This keeps every client-side consumer able to `.map()`/`.length` check the response the same way regardless of endpoint.

### 7.2 HTTP Status Code Usage

The envelope shape never changes — the **status code** is what tells the client success/failure, not the body.

| Code | Meaning | When used |
|---|---|---|
| 200 | OK | Successful GET, PATCH, DELETE |
| 201 | Created | Successful PUT (resource created) |
| 204 | (not used) | We still return 200/201 with the envelope body instead of an empty 204, so `message`/`data` are never lost |
| 400 | Bad Request | Validation failure, malformed body, missing required field |
| 401 | Unauthorized | Missing/invalid/expired auth token |
| 403 | Forbidden | Authenticated but not allowed (e.g. not the owner, not admin) |
| 404 | Not Found | Resource (user/paste/id) does not exist |
| 409 | Conflict | Duplicate email on register, slug collision, etc. |
| 410 | Gone | Paste expired or already burned |
| 422 | Unprocessable Entity | Semantically invalid input (e.g. expiry date in the past) |
| 429 | Too Many Requests | Rate limit hit (login attempts, paste creation) |
| 500 | Internal Server Error | Unhandled server-side failure |

### 7.3 One Endpoint, Multiple Methods (Resource-Based Routing)

Instead of separate `create/update/delete/get` paths, each resource exposes **one base path**, and the **HTTP method** determines the action:

| Method | Action | Convention |
|---|---|---|
| `PUT` | Create | `PUT /user` — body contains the new record's fields → `201` |
| `PATCH` | Update | `PATCH /user/{id}` **or** `PATCH /user` with `id` in the body → `200` |
| `DELETE` | Delete | `DELETE /user/{id}` **or** `DELETE /user` with `id` in the body → `200` |
| `GET` | Read (single or list) | `GET /user/{id}` **or** `GET /user` with `id` in body/query → single record; `GET /user` with no `id` → list, still wrapped in `data: []` |

**ID resolution order (applies to PATCH/DELETE/GET):** path param → query param → request body. Whichever is present is used; if more than one is present, the path param wins. This lets the same route handler work whether the client calls `/user/{id}` or posts `{ "id": "..." }` in the body.

Example route handler pseudocode:
```ts
function resolveId(req) {
  return req.params.id ?? req.query.id ?? req.body.id ?? null;
}
```

### 7.4 Consolidated Endpoint Reference

All resources follow the same PUT/PATCH/DELETE/GET pattern shown for `/user`. Action-only endpoints (login, verify, unlock) remain single-purpose since they aren't CRUD on a resource, but still return the same response envelope.

| Resource base | Method | Purpose | Success Code |
|---|---|---|---|
| `/user` | PUT | Register / create user | 201 |
| `/user` or `/user/{id}` | PATCH | Update user profile | 200 |
| `/user` or `/user/{id}` | DELETE | Delete/deactivate own account | 200 |
| `/user` or `/user/{id}` | GET | Get own profile / a user by id | 200 |
| `/user` | GET (no id) | List (admin only, or "my pastes" style) | 200 |
| `/paste` | PUT | Create text paste | 201 |
| `/paste` or `/paste/{id}` | PATCH | Update paste (title, expiry, visibility) | 200 |
| `/paste` or `/paste/{id}` | DELETE | Delete own paste | 200 |
| `/paste` or `/paste/{id}` | GET | Get paste by id/slug (checks visibility/password/burn) | 200 / 401 / 403 / 410 |
| `/paste` | GET (no id) | List public/own pastes | 200 |
| `/paste/raw` or `/paste/{id}/raw` | GET | Raw plain-text content | 200 |
| `/paste/unlock` | POST | Submit password to unlock a protected paste | 200 / 401 |
| `/file` | PUT | Upload file (multipart, or returns presigned S3 URL) | 201 |
| `/file` or `/file/{id}` | GET | Download / get file metadata | 200 |
| `/file` or `/file/{id}` | DELETE | Delete own file | 200 |
| `/auth/login` | POST | Login, returns access token + refresh cookie | 200 |
| `/auth/verify` | POST | Verify email via token/OTP | 200 |
| `/auth/refresh` | POST | Rotate refresh token | 200 |
| `/auth/forgot-password` | POST | Send reset link | 200 |
| `/auth/reset-password` | POST | Set new password | 200 |
| `/admin/user` or `/admin/user/{id}` | PATCH | Ban/suspend/verify/edit any user | 200 |
| `/admin/user` or `/admin/user/{id}` | DELETE | Delete any user | 200 |
| `/admin/user` | GET | List/search all users | 200 |
| `/admin/paste` or `/admin/paste/{id}` | PATCH | Flag/edit any paste | 200 |
| `/admin/paste` or `/admin/paste/{id}` | DELETE | Force delete any content | 200 |
| `/admin/paste` | GET | List/search all content | 200 |
| `/admin/settings` | GET | Get site settings (storage, SEO, SMTP, limits) | 200 |
| `/admin/settings` | PATCH | Update site settings | 200 |
| `/sitemap.xml` | GET | Auto-generated sitemap of public pastes (not wrapped — raw XML) | 200 |

---

## 8. Security Considerations
- All passwords (account + paste protection) hashed, never logged or returned by API.
- Burn-after-read deletion must be atomic (DB transaction: read + mark burned + delete storage object) to prevent race conditions on concurrent requests.
- Rate limit paste creation and login attempts per IP (Redis sliding window).
- Virus/malware scanning hook (e.g., ClamAV integration) recommended before serving uploaded files publicly.
- Signed, short-lived URLs for S3 downloads instead of public bucket ACLs.
- CSRF protection on cookie-based auth actions; SameSite=strict cookies.
- Strict `Content-Security-Policy` and sanitize any user-supplied HTML (titles/descriptions) to prevent XSS on public paste pages.
- File size and MIME-type allow-lists enforced server-side (admin-configurable), not just client-side.

---

## 9. Suggested Folder Structure
```
/app                     # Next.js App Router pages
  /(public)/[slug]       # Public paste/file view page
  /(auth)/login
  /(auth)/register
  /dashboard              # User dashboard
  /admin                  # Admin panel
  /api                    # Route handlers
/components
  /editor                # Monaco wrapper components
  /admin
  /shared
/db
  schema.ts
  index.ts               # Drizzle client init
/lib
  /storage                # StorageProvider implementations
  /cache                  # Redis client + helpers
  /auth                   # Token/session helpers
  /queue                  # BullMQ jobs (expiry cleanup, email)
/drizzle                 # Generated migrations
```

---

## 10. Deployment Notes
- Use `drizzle-kit` for migrations (`drizzle-kit generate` + `drizzle-kit migrate`).
- Docker Compose services: `app`, `postgres`, `redis`, and optionally `minio` for local S3-compatible testing.
- Environment variables to define: `DATABASE_URL`, `REDIS_URL`, `STORAGE_DRIVER`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `STORAGE_LOCAL_ROOT`, `SMTP_HOST/PORT/USER/PASS`, `JWT_SECRET`, `APP_URL`.
- A cron/worker process must run continuously for: expired-content cleanup, view-counter flush, and email queue processing.

---

## 11. Summary

This documentation covers the full functional and technical scope for a Pastebin-equivalent platform with file support, Monaco-based syntax highlighting, flexible visibility/expiry/security controls, dual storage backends, caching, verified authentication, and a comprehensive admin panel — built on **React/Next.js**, **Drizzle ORM**, **PostgreSQL**, and **Redis**.
