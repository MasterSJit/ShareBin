# Task 11-b — Browse & Paste View Rebuild (terminal-grade design)

**Agent**: browse-paste-view-rebuild
**Scope**: Rebuild `src/components/views/browse-view.tsx` + `src/components/views/paste-view.tsx` per Task 10 design system.

## Files written
- `/home/z/my-project/src/components/views/browse-view.tsx` (overwrite)
- `/home/z/my-project/src/components/views/paste-view.tsx` (overwrite)
- `/home/z/my-project/worklog.md` (appended Task 11-b section)

## Design decisions
- **Surfaces**: `.surface` for primary cards, `.surface-2` for the PasteView sidebar (subtle elevation distinction), `.surface-3` for inputs/hover targets. No `.glass`/`.glass-strong` used.
- **Palette**: lime `brand` for hero CTAs / active states / accents; coral `brand-2` reserved for burn/410 states. No indigo/blue/violet/emerald.
- **Typography**: `font-mono` for eyebrows (`> ls /public`, `> cat /p/{slug}`), labels, language tokens, stat labels, slug breadcrumbs. Confident sans for H1s.
- **Motion**: `Reveal` (fadeUp) for blocks, `StaggerGroup` for grids, `AnimatedNumber` for view counts, `animate-glow-pulse` on the password-gate lock, `animate-pulse-soft` on the burn banner flame + loading brand-dot, framer-motion shake (`x: [0,-8,8,-6,6,0]`) on wrong password.
- **Terminal strip**: 3 dots (two muted + one `bg-brand/70`) + mono language label + `read-only` badge above Monaco, matching the new design language's terminal vibe.

## Notable implementation notes
- `Reveal` prop is `variant` (singular) — the spec wrote `variants={fadeUp}` which is a typo; I used `variant={fadeUp}` to satisfy TS. Same for `slideInRight` (not used).
- File download uses a direct `<a href={api.fileDownloadUrl(slug)} download>` (simpler than the previous fetch+blob approach, matches spec).
- `markUnlocked` + re-fetch on password success; `x-unlocked` header is attached automatically by the api client on subsequent requests.
- `Toast` text for share: `Share code: ${slug} copied` (per spec).
- Owner-only actions (Edit/Delete) pushed right with `ml-auto` inside the action bar.
- Related section is full-width below the main grid (not inside main column), per "bottom" in spec.

## Verification
- `bun run lint` → clean (no errors/warnings).
- `npx tsc --noEmit` → no errors in either view file (pre-existing errors in `admin-view.tsx` and `examples/` are outside this task's scope).
- `dev.log` → successful compiles, no runtime errors from the views.
EOF
