# Task 8-b — Browse + Paste view UI redesign

Agent: fullstack-developer (browse + paste views — UI redesign pass)

## Files written
- `src/components/views/browse-view.tsx` — full rebuild on design system
- `src/components/views/paste-view.tsx` — full rebuild on design system
- `worklog.md` — appended Task 8-b section

## Summary
Rebuilt both views with full glassmorphism (`glass`, `glass-strong`, `gradient-border`), brand gradients (`from-brand to-brand-2`, never indigo/blue), brand-glow shadows, and Framer Motion motion helpers (`Reveal`, `StaggerGroup`, `AnimatedNumber`, `scaleIn`, `fadeUp`, `slideInRight`) plus a framer-motion `motion` shake on the password-gate card.

## Browse view highlights
- Animated header: gradient Compass tile + `text-gradient-animated` "Browse Pastes" + right-side glass stats pill.
- Sticky `glass-strong gradient-border` filter bar at `top-20` with h-11 search input (`ring-2 ring-brand` on focus), `btn-shine` refresh icon, scope `ToggleGroup` with gradient active pills (Recent / Trending / By Language), animated `<Select>` reveal for languages.
- Results: `<StaggerGroup stagger={0.06}>` wrapping `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5`, each card in `<Reveal variant={scaleIn}>`.
- Loading: 6 `shimmer glass rounded-2xl h-52` skeletons.
- Empty / error: centered `glass` cards with gradient-tinted icon circles + `btn-shine` gradient CTA buttons.
- Load more: `btn-shine bg-gradient-to-r from-brand to-brand-2` button.
- Languages sidebar (xl only, `sticky top-44`): `glass rounded-2xl p-4` with gradient underline title, top 12 language chips in `<StaggerGroup stagger={0.04}>` with `lift glow-brand-hover`, active = `bg-brand/15 text-brand` + count badge.

## Paste view highlights
- Loading: centered `Loader2` spinner (`text-brand animate-spin`) + `text-gradient` "Loading paste…" + shimmer skeleton.
- 404 / 410 / error: `glass-strong gradient-border` motion state cards with gradient-tinted icon circles + gradient Back button.
- Password gate: `glass-strong gradient-border glow-brand` motion card with framer-motion shake on wrong password (`x: [0, -8, 8, -6, 6, 0]` keyed off `shakeKey`). Top: `animate-pulse-glow` Lock icon in gradient circle (`from-brand to-brand-2`) with blurred glow layer. Password input with Lock prefix + `ring-2 ring-brand` on focus. `btn-shine` gradient Unlock button with Loader2 while submitting. Attempt counter: muted by default, `text-destructive` when `<=2`. On success: `markUnlocked(paste.id)` + `toast.success('Unlocked 🔓')` + re-fetch.
- Burn-after-read banner: `glass border-brand-2/40 rounded-xl p-4` with `animate-pulse-glow`, Flame icon in gradient tile. Separate destructive banners for expired & flagged.
- Main layout: `lg:grid lg:grid-cols-3 gap-6`. Main col `lg:col-span-2`:
  - Paste header: `text-gradient` h1 title + language/file badge (`from-brand/15 to-brand-2/15`), description, tags as `glass rounded-full px-2.5 py-0.5` chips.
  - Action bar (text): `glass rounded-xl p-2` with Copy/Raw/Share ghost buttons (`bg-muted/40 hover:bg-brand/15 hover:text-brand`).
  - Text content: `glass min-h-[500px] rounded-xl border border-border/50` container. Top bar with traffic-light dots (red/amber/brand) + mono language label + `read-only` brand badge. Monaco `CodeEditor` readOnly height=600px.
  - File content: `glass rounded-2xl p-6` card with large gradient file icon tile (with blurred glow), name, size + mime, big `btn-shine` gradient Download button.
  - Related: "More in {language}" h3 with Sparkles + `text-gradient` mono language above `<StaggerGroup stagger={0.08}>` of 3 PasteCards.
- Sidebar `lg:col-span-1` (`lg:sticky lg:top-20`): `Card glass-strong gradient-border rounded-2xl`.
  - Owner row: gradient-initials Avatar (`from-brand to-brand-2`) + name + brand uppercase "owner" label.
  - 2-col grid of `StatTile` (glass rounded-lg) for Visibility / Language (mono) / Views (`<AnimatedNumber>` count-up) / Type / Created (relative + Tooltip absolute) / Expires (relative or "Never").
  - Badges row: burn (brand-2 tint), password, flagged (destructive) — only when applicable.
  - Owner-only Edit (toasts "Open Dashboard to edit") + Delete → `AlertDialog` confirm → `api.deletePaste` → `goBrowse()` + toast.
  - Footer shows `/{slug}` in mono.

## Verification
- `bun run lint` → 0 errors, 0 warnings across the whole project.
- Dev server recompiled cleanly (no runtime errors in `dev.log`).
- No files outside the two view files (and the worklog append) were modified.
- No new shadcn components created.
- TypeScript strict, no `any`, no unused vars.
- Original prop signatures preserved: `BrowseView()` (no props), `PasteView({ idOrSlug }: { idOrSlug: string })`.
