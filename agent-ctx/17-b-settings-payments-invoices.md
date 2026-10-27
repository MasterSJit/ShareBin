# Task 17-b — Enhanced admin Settings + Invoice download + Payment email log

Agent: subagent (admin Settings rewrite + invoice download + payment email log)
Task ID: 17-b
Scope: Frontend only — only `src/components/views/admin-view.tsx` modified.

## What changed

### 1. Settings tab rewrite (full sectioned form)

The old SettingsTab was a 220-line form with General / Limits / Storage / SEO sections only. Rewrote it as a 540-line form with 9 sections covering ALL fields in `SETTING_DEFAULTS` (`src/lib/paste-utils.ts`):

1. **Branding** — `siteName`, `tagline`, `logoUrl` (+ preview), `faviconUrl` (+ preview)
2. **SEO** — `metaTitleTemplate`, `canonicalUrl`, `metaDescriptionTemplate` (Textarea, full-width), `metaKeywords`, `ogType`, `ogImage` (+ preview), `twitterCard` (Select: summary/summary_large_image), `twitterSite`
3. **Verification & Analytics** — `googleSiteVerification`, `googleAnalyticsId` (placeholder `G-XXXXXXXX`), `googleSearchConsoleUrl`, `bingSiteVerification`
4. **Captcha** — `captchaEnabled` (Switch), `captchaProvider` (Select: none/recaptcha/turnstile/hcaptcha), `captchaSiteKey`, `captchaSecretKey` (type=password)
5. **Ads Settings** — `adsEnabled` (Switch), `adsenseClient` (placeholder `ca-pub-XXXXXXXX`)
6. **Performance** — `cdnEnabled` (Switch), `enableGzip` (Switch), `cdnUrl`, `cacheTtl` (number)
7. **Social Links** — `twitter`, `github`, `discord`, `website` (4 Inputs bound to `socialLinks.{key}` via a new `setSocialField` helper that spreads the existing object — stored as JSON on save)
8. **Storage & Limits** — `storageDriver` (Select: local/s3), `defaultExpiry` (Select), `maxFileSizeBytes` (number shown as MB → bytes), `allowedFileTypes`, `guestPostingEnabled` (Switch)
9. **Robots & Sitemap** — `sitemapEnabled` (Switch), `robotsTxt` (Textarea, full-width, font-mono)

Each section uses the existing `SectionHeader` (`font-mono text-[11px] uppercase tracking-wider text-muted-foreground`) + `Divider` helpers. Save button is `btn-shine bg-brand text-brand-foreground` → `api.admin.updateSettings(settings)` → toast.

Also extended the existing `Field` component with an optional `full?: boolean` prop (adds `sm:col-span-2`) so Textareas can span both grid columns. Backward compatible.

### 2. Invoice HTML download (new Payments tab)

Added a new **Payments** tab to the admin TABS array (between Subscriptions and Usage, icon `Receipt`).

Helper functions (added just before `PaymentsTab`):
- `escapeHtml(s: string): string` — standard 5-char HTML entity escaper.
- `downloadInvoiceHTML(invoice, payment, user, plan)` — builds a self-contained HTML invoice (inline CSS, no external deps) with brand header, billed-to + issued + billing-period grid, line-items table, total, payment section (method + txnId), and a print-friendly footer. `@media print` rule strips background/padding/shadow for clean print-to-PDF. Triggers a Blob download via `URL.createObjectURL` + synthetic `<a download>` click; filename `${invoice.number}.html`. All user-supplied strings run through `escapeHtml` before interpolation.

`PaymentsTab`:
- Fetches `api.admin.listPayments(status?)` + `api.admin.listInvoices()` in parallel on mount + whenever `statusFilter` changes.
- Builds an `invoiceByPayment` Map keyed by `paymentId` so each row can find its linked invoice.
- Status filter pill row: all / completed / pending / failed / refunded.
- 8-column table: User, Plan, Amount, Status (`PaymentStatusBadge`), Method, Invoice #, Date, Actions.
- **Actions per row**:
  - **Invoice button** (Download icon) — disabled if no linked invoice; otherwise triggers `downloadInvoiceHTML`.
  - **Resend button** (Send icon) — `api.admin.updatePayment(id, { notes: 'receipt_resent' })` → toast `"Receipt email queued (check audit log)"` → refetch.
- **Record payment** dialog (top-right `btn-shine` button): user picker (admins filtered, searchable), plan picker (active non-Admin plans, auto-fills amount), amount, method, txnId, status → `api.admin.createPayment` → toast `"Payment recorded · receipt email queued (check audit log)"`.

### 3. Payment email log verification

Task said "this is already handled by the auditLog calls — just verify it works." Confirmed by reading `src/app/api/admin/payment/route.ts`:
- PUT (create) → `auditLog(adminId, 'create_payment', 'payment', id, { userId, planId, planName, amount, currency, status, method, invoiceNumber, subscriptionId })`
- PATCH (update) → `auditLog(adminId, 'update_payment', 'payment', id, { after: patch })` — so the Resend button's `{ notes: 'receipt_resent' }` patch is logged with `after.notes: 'receipt_resent'` in the metadata.
- DELETE → `auditLog(adminId, 'delete_payment', 'payment', id, { userId, amount, invoiceNumber })`

The Audit tab (rewritten in task 16-a) already has search + pagination + key-value metadata display, so admins can search `payment` to see the full trail. No backend change needed (and the task constraint limited modifications to admin-view.tsx only).

## Verification

- `bun run lint` → 0 errors, 0 warnings (after removing 4 unused eslint-disable directives that the linter flagged as unnecessary).
- Dev server compiles cleanly: `✓ Compiled in 243ms` (latest).
- File grew 5524 → 6178 lines (+654).

## Constraints respected

- Only `src/components/views/admin-view.tsx` modified.
- No indigo/blue/violet/emerald (lime `brand` + coral `brand-2` + amber-500 for pending + destructive for failed/refunded).
- TypeScript strict, no `any` (all casts explicit: `as Settings`, `as Record<string, string>`, `as PaymentRow[]`, `as InvoiceRow[]`).
- No `bun run build`.
- Uses `.surface` / `.surface-2` / `.surface-3` panels; never `.glass`.
- `font-mono text-[11px] uppercase tracking-wider text-muted-foreground` for all section headers + table headers.
