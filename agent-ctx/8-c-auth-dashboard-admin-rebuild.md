# Task ID: 8-c — Auth / Dashboard / Admin view rebuild (premium design system)

## Summary
Rebuilt the three primary account-area views (`auth-view.tsx`, `dashboard-view.tsx`, `admin-view.tsx`) on top of the Task-7 design system (glass, gradients, glow, motion helpers, brand/brand-2 palette).

## Files touched
- `src/components/views/auth-view.tsx` (rewritten)
- `src/components/views/dashboard-view.tsx` (rewritten)
- `src/components/views/admin-view.tsx` (rewritten)

## What was built

### AuthView (`{ mode: 'login' | 'register' }`)
- Centered `max-w-md` layout on `flex-1 flex items-center justify-center px-4 py-10`. Ambient brand blur behind.
- Animated brand mark: rotating conic-gradient ring (`animate-spin-slow`) + `animate-pulse-glow` aura + gradient core circle (`from-brand to-brand-2`) with `FileCode` icon.
- "PasteShare" wordmark with `text-gradient-animated`.
- Tabs styled with `data-[state=active]:bg-gradient-to-r from-brand to-brand-2 text-brand-foreground shadow-brand/30` (login ↔ register switch via store).
- Form card: `glass-strong rounded-2xl gradient-border p-6 glow-brand`, wrapped in `<Reveal variant={scaleIn}>`.
- Inputs: `bg-muted/30`, `focus-visible:ring-2 focus-visible:ring-brand`. Email input has leading Mail icon.
- Inline validation errors animate with a framer-motion keyframe shake (`x: [0, -6, 6, -4, 4, 0]`).
- Submit button: full-width `from-brand to-brand-2`, `btn-shine`, `shadow-lg shadow-brand/30`, `Loader2` spinner while submitting, `hover:scale-[1.01]`.
- Forgot password: inline flow → email → dev token shown in a glass code box with Copy button → reset form (token + new password) → toast + back-to-login.
- Demo credentials hint: glass box with `Sparkles` icon and a "Fill" button that populates `admin@pasteshare.local / admin123`.
- Success toasts: `Welcome back ✨` (login) / `Account created 🎉` (register), then `goHome()`.

### DashboardView (no props)
- Null-user guard: `glass-strong gradient-border rounded-2xl p-8` card with gradient "Log in" button → `goLogin()`.
- Header: avatar with `ring-2 ring-brand/40` + "My Dashboard" `text-gradient` + greeting.
- Layout: `lg:grid lg:grid-cols-3 gap-6`.
- **Profile card** (lg:col-span-1) — `glass-strong gradient-border p-5 glow-brand-hover`:
  - Avatar wrapped in `bg-gradient-to-br from-brand to-brand-2 p-[2px]` ring.
  - Role badge: admin = `bg-brand/15 text-brand` with Crown; user = outline.
  - Status badge: active=brand, banned=destructive, suspended/pending=amber.
  - API key: mono code box + Show/Hide + Copy + Regenerate buttons (all hover:text-brand).
  - Collapsible "Edit profile" and "Change password" (with rotating ChevronDown). Save buttons are gradient `from-brand to-brand-2`.
  - Danger zone: destructive-bordered box → "Delete account" collapsible → password confirm → AlertDialog (`glass-strong`) → `api.deleteAccount` → `setUser(null) + goHome()`.
  - Sections wrapped in `<StaggerGroup>` + `<motion.div variants={fadeUp}>`.
- **My Pastes** (lg:col-span-2):
  - Header h2 with `<AnimatedNumber value={count}>` counter.
  - Filter chips: All/Active/Expired/Burned/Flagged — glass rounded-full, active = `bg-brand/15 text-brand`.
  - List: `<StaggerGroup stagger={0.05}>` of `<motion.div variants={fadeUp}>` wrapping each `<PasteCard>` with a small Edit/Delete action row BELOW (not modifying PasteCard).
  - Loading: 4 shimmer skeletons.
  - Empty: glass card "You haven't created any pastes yet." + gradient "Create your first paste" button.
  - Edit dialog: `glass-strong` Dialog with title/description/tags/language/visibility/expiry/burn → `api.updatePaste` → refetch.
  - Delete: AlertDialog → `api.deletePaste`.

### AdminView (no props)
- Non-admin guard: glass card with destructive Lock icon + "Back to home" gradient button.
- Header: 11×11 gradient tile with Shield + "Admin Panel" `text-gradient`.
- Vertical Tabs (`orientation="vertical"`). TabsList: `glass grid grid-cols-5 gap-1 rounded-xl p-1.5 lg:flex lg:w-56 lg:flex-col`. Each trigger styled `data-[state=active]:bg-gradient-to-r from-brand to-brand-2 text-brand-foreground shadow-lg shadow-brand/20` with a lucide icon.
- **Overview**:
  - 4 KPI cards (`grid-cols-2 lg:grid-cols-4`), each `glass lift glow-brand-hover rounded-2xl p-5` with a gradient icon tile (brand→brand-2, brand-2→fuchsia, amber→brand, rose→brand-2 — no blue), `<AnimatedNumber>` value, and label. Wrapped in `<StaggerGroup stagger={0.08}>` + `<Reveal variants={scaleIn}>`.
  - 2 secondary stat cards (Flagged / Burned) side by side.
  - Traffic chart: `glass rounded-2xl p-5`, recharts `AreaChart` with emerald line (`stroke=C.brand`) + gradient fill area (linearGradient `trafficFill` brand→transparent), minimal axis lines, custom `GlassTooltip` (glass-strong).
  - Top languages: animated bar list with each bar `bg-gradient-to-r from-brand to-brand-2` and `whileInView` width animation.
- **Users**: glass search+Select bar. Table in `glass rounded-2xl overflow-hidden max-h-[60vh] overflow-y-auto` with custom scrollbar. Rows are `motion.tr` with `initial={{opacity:0,y:8}}` + index-based stagger. `hover:bg-brand/5`. Self-ban/demote/delete guarded with toast.
- **Content**: glass bar with Search + Flagged-only Switch + Expired-only Switch. Same table pattern. DropdownMenu actions: Flag/Unflag, Force expire, Visibility (public/unlisted/private), Delete (AlertDialog confirm).
- **Settings**: `glass-strong gradient-border p-6`. Save button: gradient + `btn-shine`. Fields grouped into General / Limits / Storage / SEO sections with section titles (brand icon + uppercase tracking-wider) and `<Separator>` dividers. Inputs `bg-muted/30 focus-visible:ring-2 focus-visible:ring-brand`.
- **Audit Log**: `glass rounded-2xl overflow-hidden max-h-[60vh] overflow-y-auto`. Animated rows. Action badge color by action (delete=destructive, ban/suspend=amber, update/verify=brand, else default). Metadata expandable (ChevronRight/Down) into a `<pre>` block. Empty state: centered glass card with ShieldAlert icon.

## Implementation notes
- All three files: `'use client'`, TypeScript strict, no `any` (GlassTooltip uses a typed `TooltipEntry` interface).
- Replaced `<StaggerGroup as="tbody">` (unsupported by motion-helpers) with `<TableBody>` + `<motion.tr>` + index-based transition delay for table-row stagger.
- Custom scrollbar class `[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30` on all admin tables.
- Brand colors: `C.brand = oklch(0.7 0.18 162)`, `C.brand-2 = oklch(0.65 0.22 300)`, amber/rose/fuchsia for KPI tile variety. **NO indigo/blue anywhere.**
- Layout uses `mx-auto max-w-7xl px-4 sm:px-6 py-8` container. No min-h-screen.

## Verification
- `bun run lint` → 0 errors, 0 warnings.
- Dev log: clean compiles (`✓ Compiled in 126ms`, `✓ Compiled in 187ms`, …), no JSX/SWC errors. `GET / 200` and `GET /api/auth/me 200` observed.
- Existing prop signatures preserved: `AuthView({ mode }: { mode: 'login' | 'register' })`, `DashboardView()`, `AdminView()`.

## Stage outcome
- Three view files rebuilt with the Task-7 design system. Glass + gradient + glow + staggered entrances throughout. AnimatedNumber counters, hover lifts, micro-interactions on every button/row/card. Self-ban/delete guards on admin. All API calls via the existing `api` client (`api.login/register/forgotPassword/resetPassword/updateProfile/deleteAccount/listPastes/updatePaste/deletePaste`, `api.admin.listUsers/updateUser/deleteUser/listPastes/updatePaste/deletePaste/getSettings/updateSettings/listAudit/analytics`). All cross-view navigation via `useAppStore` actions.
