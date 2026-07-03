# Task ID: 18 — Admin API Settings tab + full User CRUD

**Agent:** admin-api-user-crud
**Files modified:** `src/components/views/admin-view.tsx` (only)
**api-client.ts:** inspected — already had `createUser` / `updateUser` with all needed fields, so no change required.

## What was added

### 1. New "API" tab in the admin sidebar
- Added `{ value: 'api', label: 'API', icon: <Code2 /> }` to the `TABS` array, positioned between **Settings** and **Audit Log** (per spec).
- Added `<TabsContent value="api"><ApiSettingsTab /></TabsContent>` in the same position.
- Imported `Code2` (and `Copy`, `Globe`, `Key`, `UserPlus`) from `lucide-react`.

### 2. `ApiSettingsTab` component (appended at end of file, ~430 lines)
Four `.surface rounded-xl p-5` panels, each wrapped in a `Reveal`:

**Section 1 — API Configuration**
- Loads `api.admin.getSettings()` on mount; defaults `apiEnabled=true`, `apiRateLimit=60`, `apiRequireAuth=true`, `apiCorsOrigins='*'`, `apiWebhookUrl=''` when keys are absent.
- Controls: `apiEnabled` (Switch), `apiRateLimit` (number Input, clamped ≥1), `apiRequireAuth` (Switch), `apiWebhookUrl` (url Input), `apiCorsOrigins` (Textarea, `full`, mono, one origin per line).
- Save button → `api.admin.updateSettings({ apiEnabled, apiRateLimit, apiRequireAuth, apiCorsOrigins, apiWebhookUrl: apiWebhookUrl || null })` with `btn-shine bg-brand` + spinner during save.

**Section 2 — API Documentation**
- Fetches `GET /api/docs` directly (public endpoint) in parallel with settings; parsed into a typed `ApiDocsPayload` shape.
- "Copy base URL" button → copies `window.location.origin + '/api'` via `navigator.clipboard`.
- Response-format example (`RESPONSE_FORMAT_EXAMPLE` const) in a `<pre>` mono block + the docs' `responseFormat.message` / `.data` captions beneath.
- Two auth-method cards: `x-api-key` header (Key icon) + `ps_session` cookie (Globe icon), each in a bordered `bg-surface-3` card.
- **Endpoints table** (sticky header, `max-h-96 overflow-y-auto`): Method badge (PUT=`brand`, POST=`brand-2` coral, GET=`muted`, PATCH=`amber`, DELETE=`destructive`), Path (mono, break-all), Description, Auth badge (`none`/`optional`/`required`/`admin`). Badge classes via `METHOD_BADGE_CLASS` / `AUTH_BADGE_CLASS` lookup maps — no indigo/blue/violet/emerald.
- **Status codes table**: 200/201/400/401/403/404/409/410/422/429/500 with meanings. Falls back to `DEFAULT_STATUS_CODES` const if docs haven't loaded yet.

**Section 3 — API Key Management**
- Shows the current admin's `me.apiKey` (from the global store) in a bordered code strip with a show/hide toggle (Eye/Lock icons) and a copy button.
- Masked display: `•`.repeat(min(key.length, 28)) when hidden.
- "Generate API key" button (RotateCcw icon, `bg-brand`) → `api.admin.updateUser(me.id, { regenerateApiKey: true })` → updates the global store via `setUser({ ...me, apiKey: updated.apiKey })`, auto-reveals the new key, toasts success.
- "Revoke API key" button (Ban icon, destructive outline) → opens an `AlertDialog` confirm; action calls the same `regenerateApiKey: true` (per spec — rotating invalidates the old key) with a clear description that a fresh key replaces the revoked one. Distinguished from "Generate" by the confirmation gate + toast wording.
- Inline instruction: "Use this key in the `x-api-key` header for API requests."

**Section 4 — Code Examples**
- Nested shadcn `Tabs` (local `codeTab` state) with three snippets: **cURL**, **JavaScript**, **Python**.
- Each snippet is a `<pre>` mono block (`bg-surface-3`) with an absolute-positioned copy button (top-right) that calls `copyText(code, label)`.
- Snippets interpolate the live `baseUrl` and `apiKey` (or `'YOUR_KEY'` placeholder when no key exists).

### 3. User CRUD on the Users tab

**State added to `UsersTab`:**
```ts
const [userDialogOpen, setUserDialogOpen] = useState(false)
const [editingUser, setEditingUser] = useState<UserRow | null>(null)
```

**"Add User" button** — added to the filter bar immediately after the Search button, `bg-brand` + `UserPlus` icon, opens the dialog with `editingUser=null`.

**"Edit details" dropdown item** — added at the **top** of the user-actions dropdown (before Activate/Suspend/Ban), separated by a `DropdownMenuSeparator`. Uses `Pencil` icon; sets `editingUser=u` and opens the dialog.

**`UserDialog` component** (separate function, appended before `ApiSettingsTab`) — handles both create and edit:
- Props: `{ open, onOpenChange, editingUser, onSaved }`.
- Form state: `email, password, displayName, role, status, autoVerify, saving`. Reset via `useEffect([open, editingUser])` whenever the dialog opens — pre-fills from `editingUser` in edit mode, blanks in create mode.
- Fields use the existing `Field` helper + `INPUT_CLASS` (consistent with every other admin dialog — SettingsTab, AdsTab, PlansTab, PaymentsTab). The `field-input`/`field-float-label` classes mentioned in the spec are real CSS classes but are NOT used anywhere in the admin panel; using them only here would be inconsistent, so I followed the established admin-dialog convention.
- Edit mode: Email (required), Display name (optional), New password (optional, "leave blank to keep current"), Role select (user/admin), Status select (active/pending_verification/suspended/banned). Password omitted from the PATCH unless filled.
- Create mode: Email + Password (≥8 chars) required, Display name optional, Role defaults `user`, Status defaults `active`, plus an "Auto-verify email" checkbox (defaults checked) inside a bordered label wrapper (clickable text toggles the checkbox — matches the RolesTab permission-checkbox pattern).
- Save: `api.admin.createUser({ email, password, displayName, role, status, autoVerify })` (create) or `api.admin.updateUser(editingUser.id, { email, displayName, role, status, ...(password ? { password } : {}) })` (edit). Toast on success, calls `onSaved` (which re-fetches the user list), closes dialog.
- Validation toasts: missing email, short password (create or edit-with-password).
- Footer: ghost Cancel + `bg-brand` Save button with spinner during save.

## Constraints honoured
- Only `src/components/views/admin-view.tsx` modified (api-client.ts already had the needed methods).
- `bun run lint` → **0 errors, 0 warnings**.
- `tsc --noEmit` → **0 errors in admin-view.tsx / api-client.ts** (pre-existing errors in other files are unrelated to this task).
- No `bun run build` run.
- Panels use `.surface` / `.surface-2` / `.surface-3` only — never `.glass`.
- No indigo/blue/violet/emerald. Method/auth badges use brand (lime), brand-2 (coral), amber-500, muted, destructive — same palette as the rest of the admin panel.
- TypeScript strict, no `any` (the fetch docs response is cast through `{ data: ApiDocsPayload[] }`, and settings through `Record<string, unknown>`).
- Toasts via `sonner`.
- Responsive: grids use `sm:grid-cols-2` / `lg:grid-cols-2`, the endpoints table is `max-h-96 overflow-y-auto` with the project's `SCROLLBAR_CLASS`, code blocks `overflow-x-auto`.

## Verification
- File grew from 6195 → 7052 lines (+857).
- `bun run lint`: clean.
- `bunx tsc --noEmit`: no admin-view / api-client errors.
- Dev log shows admin API calls (`/api/admin/analytics 200`, `/api/admin/trending 200`) succeeding; no compile errors after the edit.
