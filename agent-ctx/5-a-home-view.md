# Task 5-a — Home / Create Paste view

**Agent**: full-stack-developer (home view)
**File created**: `/home/z/my-project/src/components/views/home-view.tsx`
**Status**: complete, lint-clean

## What was built

A polished, production-quality "New Paste" page that renders inside `<main className="flex-1">` (no own min-h-screen — fills naturally above the sticky footer).

### Structure
1. **Hero** — compact gradient Card with logo + tagline + 3 feature pills (100+ languages / Burn after read / Password-protected).
2. **Tabs** (Text | File, default Text) — controlled by local `tab` state.
3. **Text tab** — 2-col layout on md+:
   - Main: title Input + description Textarea + tags Input + Monaco `CodeEditor` in `min-h-[400px] flex-1 rounded-lg border bg-card` container.
   - Sidebar (`SidebarCard`, md:w-80): Language Select (deduped, "Auto-detect" first), Visibility RadioGroup (Private disabled + tooltip "Login required" when guest), Password Switch+Input (mutually exclusive with burn), Burn Switch, Expiry Select + conditional datetime-local, full-width Create button, guest hint.
4. **File tab** — 2-col layout:
   - Main: title/desc/tags + custom dropzone (drag events + hidden input ref + click & keyboard activation + 25MB client-side validation + Remove button).
   - Sidebar: same controls minus language + Upload button.
5. **RecentPastes strip** below form — fetches `api.listPastes({ scope: 'public', pageSize: 6 })`, renders `PasteCard` grid (1/2/3 cols), skeleton while loading, empty state, "Browse all →" button → `goBrowse()`.

### Key implementation details
- Shared form state across tabs (title/desc/tags/visibility/password/burn/expiry) — switching tabs preserves input.
- Mutual-exclusion guards: enabling password auto-disables burn and vice versa (via guarded setters that also clear the other).
- Auto-detect language = `plaintext` value (matches backend).
- Submission: `handleCreateText` builds JSON body (omits empty optionals, includes `expiryCustom` only when preset='custom'); `handleUploadFile` builds FormData. Both call api, toast success/error (via `ApiError`), navigate via `goView(slug)`.
- Responsive: `flex-col md:flex-row`. All shadcn components reused (no new UI components created).
- Accessibility: aria-labels on all inputs, role="button" + tabIndex=0 + onKeyDown on dropzone, focus-visible ring.
- Theme: dark default; uses only semantic Tailwind tokens (`bg-card`, `border-border`, `bg-muted`, `text-muted-foreground`, `bg-primary`/`text-primary-foreground`). NO indigo/blue.
- Layout: `mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6` — no min-h-screen, fills main naturally.

## Files touched
- Created: `src/components/views/home-view.tsx`
- Appended: `worklog.md` (Task 5-a section)
- Created: `agent-ctx/5-a-home-view.md` (this file)

## Verification
- `bun run lint` — zero issues in `home-view.tsx` (pre-existing errors in header/auth-view/dashboard-view belong to other agents, untouched).
- Dev server log shows no errors referencing home-view (only the unrelated "module not found '@/components/views/paste-view'" pre-existing errors from other agents' pending work).

## Hand-off notes for next agents
- The `SidebarCard` component (private to home-view.tsx) handles the full options sidebar (language/visibility/password/burn/expiry + submit button). If `paste-view.tsx` or `dashboard-view.tsx` need similar controls, consider extracting to a shared component — but per task constraints I kept it local.
- `LANGUAGE_OPTIONS` constant is module-level in home-view.tsx (deduped LANGUAGES with "Auto-detect" first). Other views may want to reuse — currently not exported.
- Recent pastes strip uses `api.listPastes({ scope: 'public', pageSize: 6 })` — this endpoint is already implemented and returns proper envelope.
