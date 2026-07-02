# Task 5-c — Frontend views (auth / dashboard / admin)

## Files created
- `/home/z/my-project/src/components/views/auth-view.tsx`
- `/home/z/my-project/src/components/views/dashboard-view.tsx`
- `/home/z/my-project/src/components/views/admin-view.tsx`

## What was built

### auth-view.tsx
- Combined Login / Register / Forgot-password view with mode prop (`'login' | 'register'`).
- Tabs synced with `mode`; tab change calls `goLogin()` / `goRegister()`.
- Login: inline validation; 401 → "Invalid email or password.", 429 → "Too many attempts. Wait a minute."
- Register: validates email + password ≥ 8 + matching confirm. 409 → "Email already registered."
- Forgot password: inline flow returning the dev-mode reset token with copy button + reset mini-form.
- Demo credentials hint box on the login form.

### dashboard-view.tsx
- Login-required guard if `user` is null.
- Profile card (w-80 sidebar): avatar, name, email, role/status badges, masked API key with show/hide + regenerate, edit profile / change password collapsibles, danger zone delete account (AlertDialog confirm).
- My Pastes main column: `api.listPastes({ scope: 'own', pageSize: 50 })`, client-side filter chips (All/Active/Expired/Burned/Flagged with counts), `<PasteCard>` list with overlaid Edit/Delete buttons (stopPropagation). Edit opens a Dialog with title/description/tags/language/visibility/expiry/burn. Delete uses confirm AlertDialog. Empty + skeleton states.

### admin-view.tsx
- Admin-only guard card.
- Vertical Tabs: Overview / Users / Content / Settings / Audit Log.
- Overview: 4 KPI cards + 4 secondary stat cards + recharts LineChart (14-day traffic) + vertical BarChart (top languages).
- Users: debounced search + status Select; Table with avatar/name/email/role/status/pastes/created/actions (DropdownMenu: Verify, Suspend, Ban, Make admin/Demote, Delete). Self-ban/self-demote/self-delete blocked with toast.
- Content: search + Flagged/Expired switches; Table with title/slug/type/lang/visibility/views/status/owner/created/actions (DropdownMenu: Flag/Unflag, Force expire, Make public/unlisted/private, Delete).
- Settings: form for siteName, tagline, defaultExpiry, maxFileSizeBytes (MB↔bytes), allowedFileTypes, storageDriver, guestPostingEnabled, sitemapEnabled, metaTitleTemplate, metaDescriptionTemplate, robotsTxt. Save → toast.
- Audit Log: Table with Time/Admin/Action/Target/Target ID/Metadata (expandable).
- Long lists wrapped in `max-h-[60vh] overflow-y-auto` with custom webkit-scrollbar styling.

## Notes for downstream agents
- All three views are already wired into `src/app/page.tsx` (no edits needed there).
- The only lint error remaining in the repo is in `src/components/header.tsx:25` (`react-hooks/set-state-in-effect` on the `setMounted(true)` call) — pre-existing, out of scope.
- Color palette: only Tailwind semantic colors (`primary`, `muted`, `destructive`, `border`, `card`, `popover`, etc.). No indigo/blue.
- Charts use `hsl(var(--primary))` / `hsl(var(--border))` / `hsl(var(--muted-foreground))` so they adapt to light/dark theme automatically.
