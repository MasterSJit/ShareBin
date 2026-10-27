# PasteShare

> A Pastebin-style platform for sharing text/code snippets and files — built with Next.js 16, TypeScript, Prisma, and Monaco Editor.

![PasteShare](public/logo.svg)

## Features

### Core
- **Text pastes** with Monaco Editor syntax highlighting (45+ languages)
- **File uploads** (any MIME type) with inline preview (image, video, audio, PDF, text)
- **Visibility**: Public, Unlisted, Private (login-gated)
- **Password protection** (bcrypt-hashed)
- **Burn-after-read** (permanently deleted after first view — free for everyone)
- **Expiry presets**: Never, 10m, 1h, 1d, 1w, 1M, 1y, Custom datetime
- **Raw view** endpoint (`/api/paste/raw?id=<slug>`)
- **Shareable URLs** with hash-based routing (`/#/p/<slug>`)

### Authentication & Authorization
- Email + password auth with bcrypt(12) hashing
- Signed HMAC session cookie (`ps_session`, 7-day TTL, httpOnly, SameSite=strict)
- API key auth via `x-api-key` header for external apps
- **RBAC system**: Roles, Permissions, RolePermissions (full CRUD via admin)
- 3 system roles: `user` (8 perms), `moderator` (16 perms), `admin` (25 perms)
- 25 permissions across 5 categories (paste, file, user, admin, subscription)

### Subscription & Plans
- 3 system plans: **Free** (50MB, 20/mo), **Pro** ($9.99, 5GB, 500/mo), **Business** ($29.99, 50GB, 10000/mo)
- Per-plan limits: maxStorageBytes, maxPasteSize, maxPastesPerMonth, allowedExpiryPresets
- Per-plan feature flags: allowCustomExpiry, allowBurnAfterRead, allowPassword, allowPrivate, allowFileUpload
- Usage tracking: storageBytes, pasteCount, fileCount, monthPasteCount, totalPastes, totalViews
- Payment system with invoices (auto-generated `INV-YYYYMMDD-XXXX` numbers)
- Cron endpoints for subscription maintenance

### Admin Panel
- **Overview**: KPI cards, 14-day traffic chart, top languages, trending widget
- **Users**: Full CRUD (create, edit, delete, suspend, ban, promote/demote)
- **Content**: Full CRUD with edit dialog, flag/unflag, force-expire, view-count control
- **Ads**: Full CRUD with impression/click tracking
- **Roles** (RBAC): Create/edit/delete roles with permission checklists
- **Plans**: Create/edit/delete subscription plans
- **Subscriptions**: Assign, change plan, extend with calendar, cancel
- **Payments**: Record payments, download invoices, resend receipts
- **Usage**: Per-user storage analytics with progress bars
- **Settings**: 9 sections (Branding, SEO, Analytics, Captcha, Ads, Performance, Social, Storage, Robots)
- **API**: Configuration, self-documenting endpoint docs, API key management, code examples
- **Audit Log**: Paginated, searchable, exportable, metadata in modal

### Security
- **Spam/malware scanning** before upload (XSS, SQL injection, executable files, macro documents)
- Rate limiting on login (10/min) and paste creation (30/min)
- Hard-delete on expiry/burn (no soft-delete accumulation)
- Path-traversal guarded storage
- bcrypt(12) password hashing
- Signed session tokens (HMAC-SHA256)

### Frontend
- **Terminal-grade design**: Lime accent on deep charcoal, solid elevated surfaces
- **GSAP animations**: Hero entrance, magnetic buttons, stagger reveals
- **Framer Motion**: Page transitions, scroll reveals, staggered card grids
- **Monaco Editor** with fullscreen mode
- **Responsive** (mobile-first)
- **Dark/light theme** toggle
- **Browser history** integration (Back/Forward buttons, deep-linkable URLs)

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui (New York) |
| Database | Prisma ORM + SQLite |
| Editor | Monaco Editor (`@monaco-editor/react`) |
| Auth | Custom JWT/session (bcrypt + HMAC) |
| Animations | GSAP + Framer Motion |
| Charts | Recharts |
| Icons | Lucide React |
| State | Zustand (client) + TanStack Query (server, available) |

## Quick Start

### Prerequisites
- Node.js 18+ (or Bun)
- SQLite (bundled — no separate install needed)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd pasteshare

# Install dependencies
bun install

# Set up environment variables
cp .env.example .env
# Edit .env — set DATABASE_URL, SESSION_SECRET, etc.

# Push the database schema
bun run db:push

# Seed the database (creates admin user + roles + plans + settings)
bun run prisma/seed.ts

# Start the dev server
bun run dev
```

The app will be available at `http://localhost:3000`.

### Demo Admin Account
- **Email**: `admin@pasteshare.local`
- **Password**: `admin123`

## Project Structure

```
/
├── prisma/
│   ├── schema.prisma          # Database schema (User, Paste, Role, Plan, etc.)
│   └── seed.ts                # Seeds admin user, roles, plans, settings
├── src/
│   ├── app/
│   │   ├── api/               # API route handlers (resource-based CRUD)
│   │   │   ├── auth/          # login, logout, me, verify, refresh, forgot/reset-password
│   │   │   ├── paste/         # CRUD + raw + unlock
│   │   │   ├── file/          # Upload + download + delete
│   │   │   ├── user/          # Register + profile + update + delete
│   │   │   ├── me/limits/     # Current user's plan + usage
│   │   │   ├── ads/           # Public ad serving + click tracking
│   │   │   ├── languages/     # Public language list
│   │   │   ├── docs/          # Self-documenting API docs
│   │   │   ├── cron/          # Cleanup + subscription maintenance
│   │   │   └── admin/         # Admin-only: user, paste, role, plan, subscription, payment, etc.
│   │   ├── layout.tsx         # Root layout (metadata, theme, background)
│   │   ├── page.tsx           # SPA entry (view switcher via Zustand)
│   │   └── globals.css        # Design system (colors, surfaces, fields, animations)
│   ├── components/
│   │   ├── ui/                # shadcn/ui components (button, card, dialog, table, etc.)
│   │   ├── views/             # Page views (home, browse, paste, auth, dashboard, admin)
│   │   ├── editor/            # Monaco editor wrapper
│   │   ├── header.tsx         # Glass nav with back button + history
│   │   ├── footer.tsx         # Sticky footer
│   │   ├── paste-card.tsx     # Reusable paste card
│   │   ├── file-preview.tsx   # Inline preview (image/video/audio/pdf/text)
│   │   ├── ad-slot.tsx        # Ad display component
│   │   ├── animated-background.tsx
│   │   ├── motion-helpers.tsx # Framer Motion variants + Reveal/StaggerGroup/AnimatedNumber
│   │   └── gsap-helpers.tsx   # GSAP hooks (hero entrance, magnetic, field glow)
│   └── lib/
│       ├── db.ts              # Prisma client
│       ├── auth.ts            # Session + bcrypt + API key helpers
│       ├── api-response.ts    # Standard {message, data:[]} envelope + status helpers
│       ├── api-client.ts      # Frontend API client
│       ├── store.ts           # Zustand store (view state + hash routing)
│       ├── rbac.ts            # Permissions + plan limits + usage tracking
│       ├── cleanup.ts         # Hard-delete expired/burned pastes
│       ├── security-scan.ts   # Spam/malware scanning
│       ├── storage.ts         # LocalStorageProvider
│       ├── cache.ts           # In-memory TTL cache + rate limiter
│       ├── parse-body.ts      # Robust JSON body parser
│       └── paste-utils.ts     # Slug gen, expiry compute, audit log, settings
├── prisma/schema.prisma
├── package.json
└── README.md
```

## API Design

### Response Envelope

Every API response uses the same fixed shape:

```json
{
  "message": "Paste created successfully",
  "data": [{ "id": "abc123", "slug": "k3Xy9a", "textContent": "hello" }]
}
```

- `message` — human-readable status string
- `data` — **always an array**, possibly empty. Single-resource responses wrap the item in a one-element array.

### Status Codes

| Code | Meaning |
|---|---|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request (validation) |
| 401 | Unauthorized (auth required) |
| 403 | Forbidden (RBAC/plan limit) |
| 404 | Not Found |
| 409 | Conflict (duplicate) |
| 410 | Gone (expired/burned) |
| 422 | Unprocessable Entity (spam scanner) |
| 429 | Too Many Requests (rate limit) |
| 500 | Internal Server Error |

### Resource-Based CRUD

Each resource exposes one base path; the HTTP method determines the action:

| Method | Action | Example |
|---|---|---|
| `PUT` | Create | `PUT /api/paste` with body → 201 |
| `PATCH` | Update | `PATCH /api/paste` with `{id, ...fields}` in body → 200 |
| `DELETE` | Delete | `DELETE /api/paste` with `{id}` in body → 200 |
| `GET` | Read | `GET /api/paste` (list) or `GET /api/paste?id=<slug>` (single) |

**ID resolution**: `path param → query param → request body` (path wins).

### Authentication

Two methods:
1. **Session cookie** — `ps_session` (httpOnly, set by login/register)
2. **API key** — `x-api-key: ps_<hex>` header (generate from dashboard or admin)

### Self-Documenting

Fetch `GET /api/docs` for the full API documentation with request/response examples for every public endpoint.

## Database Schema

### Core Models
- **User** — email, passwordHash, role, roleId (RBAC), status, apiKey
- **Paste** — slug, contentType (text/file), textContent, storageKey, visibility, passwordHash, burnAfterRead, viewCount, expiresAt
- **PasteAccessGrant** — pasteId + userId (for private paste sharing)

### RBAC Models
- **Role** — name, description, color, isSystem
- **Permission** — name, description, category
- **RolePermission** — join table (roleId + permissionId)

### Subscription Models
- **Plan** — name, monthlyPrice, maxStorageBytes, maxPasteSize, maxPastesPerMonth, feature flags
- **Subscription** — userId, planId, status, expiresAt
- **UsageRecord** — userId, storageBytes, pasteCount, monthPasteCount, totalViews
- **Payment** — userId, planId, amount, status, method, txnId, invoiceNumber
- **Invoice** — paymentId, number, amount, planName, periodStart/End

### Other
- **AuditLog** — adminId, action, targetType, targetId, metadata (JSON)
- **SiteSetting** — key-value (JSON string values)
- **Ad** — name, slot, adType, content, imageUrl, linkUrl, impressions, clicks

## Configuration

### Environment Variables

```env
DATABASE_URL="file:./db/custom.db"
SESSION_SECRET="your-secret-key-at-least-32-characters-long"
STORAGE_LOCAL_ROOT="./storage"  # optional, defaults to ./storage
```

### Site Settings (Admin Panel)

All configurable from the admin Settings tab:

- **Branding**: siteName, tagline, logoUrl, faviconUrl
- **SEO**: metaTitleTemplate, metaDescriptionTemplate, metaKeywords, canonicalUrl, ogType, ogImage, twitterCard, twitterSite
- **Verification**: googleSiteVerification, bingSiteVerification
- **Analytics**: googleAnalyticsId, googleSearchConsoleUrl
- **Captcha**: captchaEnabled, captchaProvider (none/recaptcha/turnstile/hcaptcha), captchaSiteKey, captchaSecretKey
- **Ads**: adsEnabled, adsenseClient
- **Performance**: cdnEnabled, cdnUrl, cacheTtl, enableGzip
- **Social**: socialLinks (JSON: twitter, github, discord, website)
- **Storage**: storageDriver (local/s3), maxFileSizeBytes, allowedFileTypes, guestPostingEnabled
- **SEO/Robots**: sitemapEnabled, robotsTxt
- **API**: apiEnabled, apiRateLimit, apiRequireAuth, apiCorsOrigins, apiWebhookUrl

## Cron Jobs

| Endpoint | Schedule | Description |
|---|---|---|
| `POST /api/cron/cleanup` | Every 10 min | Hard-delete expired + burned pastes |
| `POST /api/cron/subscriptions` | Daily | Expire overdue subscriptions, log expiring-soon |

Example cron (crontab):
```cron
*/10 * * * * curl -X POST https://yoursite.com/api/cron/cleanup
0 0 * * * curl -X POST https://yoursite.com/api/cron/subscriptions
```

## Development

### Commands

```bash
bun run dev          # Start dev server (port 3000)
bun run lint         # Run ESLint
bun run db:push      # Push schema to database
bun run db:generate  # Regenerate Prisma client
bun run db:reset     # Reset database (destructive)
bun run prisma/seed.ts  # Seed admin user + roles + plans + settings
```

### Design System

The UI uses a "terminal-grade" design language:
- **Colors**: Lime (`brand`) + Coral (`brand-2`) on deep charcoal. NO indigo/blue/violet.
- **Surfaces**: `.surface`, `.surface-2`, `.surface-3` (solid elevated panels, not glass blur)
- **Fields**: `.field-input` with floating labels + animated bottom accent bar
- **Typography**: `font-mono` for labels/metadata (uppercase, tracked), sans for body
- **Motion**: GSAP hero entrances, Framer Motion page transitions + scroll reveals

## License

MIT
