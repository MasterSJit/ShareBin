# Task 16-b — Ads / Payments / Invoices / Subscriptions cron

Agent: subagent (backend — Ads management + Payments/Invoices + Subscription cron)
Task ID: 16-b
Scope: Backend APIs only (no UI changes).

## Files created

- `src/app/api/admin/ad/route.ts` — Admin Ads CRUD (GET/PUT/PATCH/DELETE) guarded by `admin:content` perm (admin role fallback). Validates slot/adType against whitelists; dedupes `name` on create + patch; `parseDate` helper supports null/empty/ISO strings (treats `undefined` as "not provided", null/empty as explicit null, invalid strings as 400). Audit logs `create_ad`/`update_ad`/`delete_ad`.
- `src/app/api/admin/ad/[id]/route.ts` — GET single ad by id (admin only), includes `updatedAt`.
- `src/app/api/ads/route.ts` — Public GET `?slot=sidebar`. Filters `isActive=true` AND `(startsAt IS NULL OR <= now)` AND `(endsAt IS NULL OR >= now)`. Best-effort increments `impressions` via `updateMany` (no fail-on-error).
- `src/app/api/ads/click/route.ts` — Public POST `{ id }` — increments `clicks` by 1. 404 if ad not found.
- `src/app/api/admin/payment/route.ts` — Admin Payments (guarded by `admin:subscriptions`). GET lists with `?status=` filter, includes `user.{email,displayName}` + `plan.{name,monthlyPrice}`. PUT creates payment in a transaction: auto-generates invoice number `INV-YYYYMMDD-XXXX` (reroll on collision, fallback to timestamp suffix), creates linked Invoice record (status `paid` if payment is `completed` else `issued`), cancels existing active subs for the user and creates a new active sub (30-day expiry for paid plans, null/lifetime for free plans), links `subscriptionId` back to the payment. PATCH updates status/txnId/notes; if status → `completed`, marks invoice `paid`; if → `refunded`/`failed`, marks invoice `void`/`issued`. DELETE cascade-removes invoice (per schema `onDelete: Cascade`). All mutations audit-logged.
- `src/app/api/admin/invoice/route.ts` — Admin GET list (guarded by `admin:subscriptions`), supports `?userId=` filter, includes user email + displayName.
- `src/app/api/admin/invoice/[id]/route.ts` — Admin GET single invoice, returns nested `{invoice, user, payment}` with payment's plan included.
- `src/app/api/cron/subscriptions/route.ts` — POST (no auth; endpoint path is the secret). Calls `expireOverdueSubscriptions()`, then `getExpiringSubscriptions(7)` and audit-logs each as `subscription_expiring_soon` (attributed to the first admin user since `AuditLog.adminId` is a User FK). Returns summary `{expired, expiringSoon}`. GET also allowed for simple cron triggers.

## Files modified

- `src/lib/api-client.ts` — Added to top-level `api`:
  - `listAds(slot?)` → `GET /api/ads?slot=...`
  - `adClick(id)` → `POST /api/ads/click`
  
  Added to `api.admin`:
  - `listAds()` / `getAd(id)` / `createAd(body)` / `updateAd(id, patch)` / `deleteAd(id)`
  - `listPayments(status?)` / `createPayment(body)` / `updatePayment(id, patch)` / `deletePayment(id)`
  - `listInvoices(userId?)` / `getInvoice(id)`
  
  All with inline TypeScript shapes matching the API responses.

## Verification

- `bun run lint` → 0 errors, 0 warnings.
- Dev server compiles cleanly; no runtime errors in `dev.log`.
- Smoke tested all endpoints via curl with admin session cookie:
  1. **Ads CRUD**: created ad (no dates), fetched via public endpoint (impressions 1→2 after 2 calls), clicked 3x (clicks=3), PATCHed (rename + isActive=false → no longer in public list), DELETE → gone. Single-ad GET works.
  2. **Payments**: PUT created a $9.99 Pro payment → returned with auto-gen `invoiceNumber` `INV-20260703-8855`. Invoice auto-created with status `paid`, periodEnd = +30d. Active Pro subscription auto-assigned to the user (expiresAt = +30d), `subscriptionId` linked back. GET list with `?status=completed` filter works. PATCH status → `refunded` → invoice status auto-updated to `void`. DELETE payment → invoice cascade-deleted.
  3. **Invoices**: GET list (with `?userId=` filter) + GET single (returns nested `{invoice, user, payment.{plan}}`).
  4. **Cron subscriptions**: created a sub expiring in 5 days → POST `/api/cron/subscriptions` returned `{expired:0, expiringSoon:1}` + audit log entry `subscription_expiring_soon` with full metadata (userId, userEmail, planId, planName, expiresAt). Created an already-expired sub → next cron run returned `{expired:1, expiringSoon:0}` — overdue sub was marked `expired` by `expireOverdueSubscriptions()`.

## Summary

All 6 task items delivered: Ads CRUD (admin) + single-by-id; public Ads list + click tracking; Payments CRUD with auto invoice + subscription assignment; Invoices list + single; Subscription maintenance cron. All responses use the standard `{message, data:[]}` envelope, all admin routes check `getSession()` + `hasPermission()`/`role==='admin'`, all body parsing via `parseJsonBody`, all mutations audit-logged. TypeScript strict, no `any`.
