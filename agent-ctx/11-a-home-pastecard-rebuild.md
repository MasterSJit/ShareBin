# Task 11-a — home-pastecard-rebuild

**Agent:** home-pastecard-rebuild
**Task:** Rebuild `PasteCard` + `HomeView` with the new terminal-grade design language (Task 10 spec).

## Files touched
- `src/components/paste-card.tsx` — full rewrite
- `src/components/views/home-view.tsx` — full rewrite
- `worklog.md` — appended Task 11-a entry

## What I built

### `paste-card.tsx`
- Root `<motion.button>` (`whileHover={{ y: -2 }}`) wrapping a `.surface relative overflow-hidden rounded-xl p-4` card. `focus-brand` for keyboard ring.
- Animated lime left-border accent: two stacked absolutely-positioned `w-0.5` strips. Base = `bg-border h-full` (always visible). Brand = `bg-brand origin-top transition-[height] duration-300 ease-out group-hover:h-full` (0→100% from top on hover via CSS group-hover).
- Header: 8x8 icon tile (`bg-surface-3` text / `bg-brand/15 text-brand` files) with FileText/FileType. Title `font-medium text-sm truncate flex-1`. Right: mono language badge OR file-size badge (`bg-muted`).
- Description `line-clamp-1`. Text preview `<pre>` `font-mono text-[11px] bg-muted/30 max-h-20` (200 chars + "…").
- Footer `font-mono text-[11px]`: owner (gradient dot if owner / muted dot if guest + name), visibility icon-only (Globe/Link2/Lock in shadcn Tooltip w/ `asChild` span to avoid nested buttons), views (Eye + count), relative time. Right-aligned icon-only badges w/ Tooltips: burn (`Flame text-brand-2`), password (`Lock`), flagged (`Flag text-destructive`).
- Whole card clickable → `goView(paste.slug)`. Card border shifts `group-hover:border-brand/40`.
- No 3D tilt (per spec — refined hover instead). Parent wraps in `<Reveal>` for entrance.

### `home-view.tsx`
- Hero (left-aligned, `<Reveal>`): mono `> new_paste.sh` eyebrow in `text-brand`. H1 `text-4xl md:text-5xl font-semibold tracking-tight` "Share code, beautifully." with `text-gradient` on "beautifully.". Subtitle + 3 `brand-dot` feature chips.
- Create panel: `.surface overflow-hidden rounded-2xl` with `.terminal-strip h-10` window chrome (3 dots rose/amber/lime + mono "pasteshare — new"). Body `p-5 md:p-6`.
- Tabs (Text/File) — minimal underline style. Overrode shadcn TabsList/TabsTrigger classes for transparent bg, `border-b-2 border-transparent` inactive, `data-[state=active]:border-brand` active.
- Text tab `lg:grid-cols-3`: main = borderless bottom-line inputs (title `text-xl font-medium`, description, tags w/ Tag icon prefix) + Monaco in `rounded-lg border border-border bg-surface-2` container w/ sub-bar showing language + "read-write" badge. Sidebar = `.surface-2 rounded-xl p-4` with Language `<Select>`, 3 stacked visibility radio cards (private disabled for guests w/ mono "login required"), Password Switch (brand) + input, Burn Switch (brand-2) + helper text, Expiry `<Select>` w/ custom datetime reveal, full-width `btn-shine bg-brand` submit, guest login footer.
- File tab: same sidebar (hideLanguage). Dropzone `min-h-[280px]` dashed border, `bg-surface-2/50 hover:border-brand hover:bg-brand/5`, drag-over → `border-brand bg-brand/5`. Empty state: Upload in `bg-surface-3` circle + label + mono max-size. Selected: file row card w/ `bg-brand/15 text-brand` icon + name + mono size/type + X remove.
- Recent section: header `Recent` + mono `/public` + "Browse all →" ghost button. Loading = 3 `.shimmer bg-surface h-40 rounded-xl`. Empty = centered text. Grid = `<StaggerGroup stagger={0.07}>` over `grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4`, each `<Reveal variant={fadeUp}><PasteCard/></Reveal>`.
- Submit: `api.createPaste(body)` / `api.uploadFile(fd)` → `toast.success` → `goView(slug)`. Errors via `ApiError`. Password/Burn mutual exclusion at setter level + Switch `disabled`.

## Design-language compliance
- Used `.surface`/`.surface-2`/`.surface-3` only — no `.glass`/`.glass-strong`.
- Brand=lime (`bg-brand`, `text-brand`, `border-brand`, `ring-brand`) as primary accent. Brand-2=coral used only for the burn switch + burn badge.
- NO indigo/blue/violet/emerald anywhere.
- Mono (`font-mono`) used for: eyebrow, window-chrome label, all sidebar section labels (`text-[11px] uppercase tracking-wider`), language badge, file-size badge, file metadata, footer metadata, badge helper texts.
- Motion: subtle (motion.button `whileHover y:-2`, Reveal/StaggerGroup entrance, framer-motion file-row fade-in). No decorative float/glow loops in these two files.
- Touch targets ≥ 44px (Switch is 32px but is a toggle, not a primary touch target; radio cards and buttons are ≥ 40px).
- Responsive: single-col mobile → 2-col `lg:grid-cols-3` for create panel; `md:grid-cols-2 xl:grid-cols-3` for recent grid.

## Verification
- `bun run lint`: 0 errors, 0 warnings in touched files (the only warning is in `dashboard-view.tsx` which I did not touch).
- Dev server compiles cleanly (`✓ Compiled in 85ms`) and `GET / 200` + `GET /api/paste?scope=public&pageSize=6 200` in dev log.
- TS strict, no `any`, no unused vars.
- Kept prop signatures: `PasteCard({ paste }: { paste: SafePaste })` and `HomeView()`.

## Constraints honored
- Did NOT modify any files outside the two listed + worklog.
- Did NOT use `.glass`/`.glass-strong`.
- Did NOT use indigo/blue/violet/emerald.
- Did NOT `bun run build`.
- Kept the existing API contract: `api.createPaste`, `api.uploadFile`, `api.listPastes`.
- `goHome`/`goBrowse`/`goView` from store push history entries automatically (Task 10) — I just call them, no special history handling needed.
EOF
echo "agent-ctx file written"