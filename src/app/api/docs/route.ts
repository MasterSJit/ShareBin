import { NextRequest } from 'next/server'
import { ok } from '@/lib/api-response'

/**
 * GET /api/docs — self-documenting API documentation.
 *
 * Returns a structured description of every public endpoint, the auth
 * mechanisms, the response envelope, and the status codes used across
 * the API. External apps can fetch this to bootstrap client bindings.
 */

type EndpointDoc = {
  method: 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  description: string
  auth: 'none' | 'optional' | 'required' | 'admin'
  body?: Record<string, string>
  query?: Record<string, string>
  response: string
}

type StatusCodeDoc = { code: number; meaning: string }

type ApiDocs = {
  baseUrl: string
  auth: { type: string; description: string }
  apiKey: { header: string; description: string }
  responseFormat: { message: string; data: string }
  statusCodes: StatusCodeDoc[]
  endpoints: EndpointDoc[]
}

const DOCS: ApiDocs = {
  baseUrl: '/',
  auth: {
    type: 'session_cookie',
    description:
      'Authentication uses a signed HMAC session token stored in the httpOnly `ps_session` cookie (7-day TTL). Obtain it via POST /api/auth/login or PUT /api/user (register). The cookie is sent automatically by browsers; non-browser clients should use the API key mechanism below.',
  },
  apiKey: {
    header: 'x-api-key',
    description:
      'External apps may instead send a user API key in the `x-api-key` header. Generate a key from the dashboard (PATCH /api/user with { regenerateApiKey: true }) — the response SafeUser.apiKey is the secret value (`ps_<hex>`). API key auth is equivalent to session auth for all endpoints that accept sessions.',
  },
  responseFormat: {
    message: 'string — human-readable status message',
    data: 'array — always an array, possibly empty. Single-resource responses still wrap the item in a one-element array.',
  },
  statusCodes: [
    { code: 200, meaning: 'OK — request succeeded' },
    { code: 201, meaning: 'Created — resource created successfully' },
    { code: 400, meaning: 'Bad Request — malformed body or missing required field' },
    { code: 401, meaning: 'Unauthorized — authentication required or invalid' },
    { code: 403, meaning: 'Forbidden — authenticated but not allowed (RBAC/plan limit)' },
    { code: 404, meaning: 'Not Found — resource does not exist' },
    { code: 409, meaning: 'Conflict — duplicate resource (e.g. email already registered)' },
    { code: 410, meaning: 'Gone — paste has expired or been burned' },
    { code: 422, meaning: 'Unprocessable Entity — semantic validation error' },
    { code: 429, meaning: 'Too Many Requests — rate limit hit' },
    { code: 500, meaning: 'Internal Server Error' },
  ],
  endpoints: [
    // ---- Paste (text) ----
    {
      method: 'PUT',
      path: '/api/paste',
      description: 'Create a new text paste. Body is scanned for spam/malware signatures.',
      auth: 'optional',
      body: {
        title: 'string (optional, max 255)',
        description: 'string (optional, max 1000)',
        tags: 'string (comma-separated, max 500)',
        language: 'string (default "plaintext")',
        textContent: 'string (required)',
        visibility: '"public" | "unlisted" | "private"',
        password: 'string (optional — Pro+ plan)',
        burnAfterRead: 'boolean (optional — Pro+ plan)',
        expiryPreset: '"never"|"10m"|"1h"|"1d"|"1w"|"1M"|"1y"|"custom"',
        expiryCustom: 'ISO datetime (required when expiryPreset="custom")',
      },
      response: '{message, data:[SafePaste]}',
    },
    {
      method: 'GET',
      path: '/api/paste',
      description:
        'List public/own/trending pastes, or fetch a single paste by id or slug. Single-paste fetch increments the view counter and may trigger burn-after-read hard-delete.',
      auth: 'optional',
      query: {
        id: 'paste id or slug — when present, returns a single paste',
        scope: '"public" (default) | "own" | "trending" | "language"',
        language: 'filter by language (with scope=language)',
        q: 'full-text search across title/description/content/tags/language',
        page: 'page number (default 1)',
        pageSize: 'page size (default 20, max 50)',
      },
      response: '{message, data:[SafePaste]}',
    },
    {
      method: 'PATCH',
      path: '/api/paste',
      description: 'Update an existing paste (owner or admin only). Pass id in body or query.',
      auth: 'required',
      body: {
        id: 'string (required — paste id or slug)',
        title: 'string (optional)',
        description: 'string (optional)',
        tags: 'string (optional)',
        language: 'string (optional)',
        textContent: 'string (optional — replaces content)',
        visibility: '"public"|"unlisted"|"private" (optional)',
        password: 'string|null (optional — null clears)',
        burnAfterRead: 'boolean (optional)',
        expiryPreset: 'string (optional)',
        expiryCustom: 'ISO datetime (optional)',
      },
      response: '{message, data:[SafePaste]}',
    },
    {
      method: 'DELETE',
      path: '/api/paste',
      description: 'Permanently delete a paste (owner or admin only). Hard-deletes the record + storage file.',
      auth: 'required',
      body: { id: 'string (paste id or slug)' },
      response: '{message, data:[]}',
    },
    {
      method: 'GET',
      path: '/api/paste/[id]',
      description: 'Path-style fetch of a single paste by id or slug. Same access rules as /api/paste?id=.',
      auth: 'optional',
      response: '{message, data:[SafePaste]}',
    },
    {
      method: 'GET',
      path: '/api/paste/raw',
      description: 'Raw plain-text body of a text paste (NOT wrapped in the standard envelope).',
      auth: 'optional',
      query: { id: 'paste id or slug (required)' },
      response: 'text/plain body',
    },
    {
      method: 'POST',
      path: '/api/paste/unlock',
      description: 'Verify a paste password. On 200, the client may re-request the paste with the `x-unlocked: <pasteId>` header.',
      auth: 'optional',
      body: { id: 'string (required)', password: 'string (required)' },
      response: '{message, data:[{id, unlocked:true}]}',
    },

    // ---- File upload ----
    {
      method: 'PUT',
      path: '/api/file',
      description: 'Multipart/form-data file upload. Scans file name + bytes for malware.',
      auth: 'optional',
      body: {
        file: 'Blob (required)',
        title: 'string (optional)',
        description: 'string (optional)',
        tags: 'string (optional)',
        visibility: '"public"|"unlisted"|"private"',
        password: 'string (optional)',
        burnAfterRead: 'boolean (optional)',
        expiryPreset: 'string (optional)',
        expiryCustom: 'ISO datetime (optional)',
      },
      response: '{message, data:[SafePaste]}',
    },
    {
      method: 'GET',
      path: '/api/file',
      description:
        'Download a file by id/slug (streams raw bytes). Use ?meta=1 for metadata only (respects password gate; returns SafePaste).',
      auth: 'optional',
      query: { id: 'paste id or slug (required)', meta: '"1" for metadata only' },
      response: 'binary stream OR {message, data:[SafePaste]} when meta=1',
    },
    {
      method: 'DELETE',
      path: '/api/file',
      description: 'Permanently delete an uploaded file (owner or admin only).',
      auth: 'required',
      body: { id: 'string (paste id or slug)' },
      response: '{message, data:[]}',
    },

    // ---- Languages ----
    {
      method: 'GET',
      path: '/api/languages',
      description: 'List distinct languages used across public, non-expired text pastes.',
      auth: 'none',
      response: '{message, data:[{language, count}]}',
    },

    // ---- Auth ----
    {
      method: 'POST',
      path: '/api/auth/login',
      description: 'Authenticate with email + password; sets the `ps_session` cookie.',
      auth: 'none',
      body: { email: 'string (required)', password: 'string (required)' },
      response: '{message, data:[SafeUser]}',
    },
    {
      method: 'POST',
      path: '/api/auth/logout',
      description: 'Clear the session cookie.',
      auth: 'none',
      response: '{message, data:[]}',
    },
    {
      method: 'GET',
      path: '/api/auth/me',
      description: 'Fetch the currently authenticated user.',
      auth: 'required',
      response: '{message, data:[SafeUser]}',
    },
    {
      method: 'POST',
      path: '/api/auth/verify',
      description: 'Mark the current user as email-verified (sandbox auto-verifies).',
      auth: 'required',
      response: '{message, data:[{id, verified:true}]}',
    },
    {
      method: 'POST',
      path: '/api/auth/refresh',
      description: 'Refresh the session cookie (extends TTL by 7 days).',
      auth: 'required',
      response: '{message, data:[SafeUser]}',
    },
    {
      method: 'POST',
      path: '/api/auth/forgot-password',
      description: 'Request a password reset email (sandbox: returns the token directly).',
      auth: 'none',
      body: { email: 'string (required)' },
      response: '{message, data:[{resetToken?}]}',
    },
    {
      method: 'POST',
      path: '/api/auth/reset-password',
      description: 'Reset password using a reset token.',
      auth: 'none',
      body: { token: 'string (required)', password: 'string (required, min 8)' },
      response: '{message, data:[]}',
    },

    // ---- User ----
    {
      method: 'PUT',
      path: '/api/user',
      description: 'Register a new user account; sets the session cookie on success.',
      auth: 'none',
      body: {
        email: 'string (required)',
        password: 'string (required, min 8)',
        displayName: 'string (optional)',
      },
      response: '{message, data:[SafeUser]}',
    },
    {
      method: 'GET',
      path: '/api/user',
      description:
        'Own profile (default), a specific user (?id=), or admin user list (?list=1, admin only).',
      auth: 'required',
      query: { id: 'string (optional)', list: '"1" (optional, admin only)' },
      response: '{message, data:[SafeUser]}',
    },
    {
      method: 'PATCH',
      path: '/api/user',
      description: 'Update own profile. Can change displayName, password (requires currentPassword), or regenerate the API key.',
      auth: 'required',
      body: {
        displayName: 'string (optional)',
        currentPassword: 'string (required when newPassword is set)',
        newPassword: 'string (optional, min 8)',
        regenerateApiKey: 'boolean (optional)',
      },
      response: '{message, data:[SafeUser]}',
    },
    {
      method: 'DELETE',
      path: '/api/user',
      description: 'Permanently delete own account (requires currentPassword).',
      auth: 'required',
      body: { currentPassword: 'string (required)' },
      response: '{message, data:[]}',
    },

    // ---- Me ----
    {
      method: 'GET',
      path: '/api/me/limits',
      description: "Current user's plan, subscription, and usage counters.",
      auth: 'required',
      response: '{message, data:[{user, plan, subscription, usage}]}',
    },

    // ---- Cron ----
    {
      method: 'POST',
      path: '/api/cron/cleanup',
      description: 'Run background cleanup — hard-deletes expired + burned pastes. Returns a summary.',
      auth: 'none',
      response: '{message, data:[{expired, burned}]}',
    },

    // ---- Admin: settings ----
    {
      method: 'GET',
      path: '/api/admin/settings',
      description: 'Fetch all site settings (merged with defaults).',
      auth: 'admin',
      response: '{message, data:[Record<string, unknown>]}',
    },
    {
      method: 'PATCH',
      path: '/api/admin/settings',
      description: 'Partially update site settings. Validates a few critical fields.',
      auth: 'admin',
      body: { '...key': 'any setting key (see SiteSetting model)' },
      response: '{message, data:[Record<string, unknown>]}',
    },

    // ---- Admin: analytics / audit / trending ----
    {
      method: 'GET',
      path: '/api/admin/analytics',
      description: 'Dashboard summary — totals, top languages, traffic over last 14 days.',
      auth: 'admin',
      response: '{message, data:[{totalUsers, totalPastes, totalFiles, ...}]}',
    },
    {
      method: 'GET',
      path: '/api/admin/audit',
      description: 'Recent admin audit log entries.',
      auth: 'admin',
      query: { limit: 'number (default 100, max 200)' },
      response: '{message, data:[SafeAuditLog]}',
    },
    {
      method: 'GET',
      path: '/api/admin/trending',
      description: 'Top pastes by view count over a configurable time window.',
      auth: 'admin',
      query: { limit: 'number (default 5)', days: 'number (0 = all time)' },
      response: '{message, data:[SafePaste]}',
    },

    // ---- Admin: pastes / users ----
    {
      method: 'GET',
      path: '/api/admin/paste',
      description: 'Admin listing of all pastes with filters (expired, flagged, scope).',
      auth: 'admin',
      response: '{message, data:[SafePaste]}',
    },
    {
      method: 'PATCH',
      path: '/api/admin/paste',
      description:
        'Admin mutation on any paste — edit fields, flag/unflag, force-expire, reset/set view count, hard-delete.',
      auth: 'admin',
      body: { id: 'string (required)', '...fields': 'see SafePaste + resetViews/viewCount/forceExpire' },
      response: '{message, data:[SafePaste]}',
    },
    {
      method: 'GET',
      path: '/api/admin/user',
      description: 'Admin listing of all users.',
      auth: 'admin',
      response: '{message, data:[SafeUser]}',
    },
    {
      method: 'PATCH',
      path: '/api/admin/user/[id]',
      description: 'Admin mutation on a user — change role, status, displayName.',
      auth: 'admin',
      body: { role: 'string', status: 'string', displayName: 'string' },
      response: '{message, data:[SafeUser]}',
    },
    {
      method: 'DELETE',
      path: '/api/admin/user/[id]',
      description: 'Admin: permanently delete a user account.',
      auth: 'admin',
      response: '{message, data:[]}',
    },

    // ---- Admin: RBAC ----
    {
      method: 'GET',
      path: '/api/admin/role',
      description: 'List all RBAC roles with their permissions.',
      auth: 'admin',
      response: '{message, data:[Role]}',
    },
    {
      method: 'PUT',
      path: '/api/admin/role',
      description: 'Create a new custom role with a permission set.',
      auth: 'admin',
      body: { name: 'string', description: 'string', color: 'string', permissionIds: 'string[]' },
      response: '{message, data:[Role]}',
    },
    {
      method: 'PATCH',
      path: '/api/admin/role',
      description: 'Update an existing role (name, description, color, permissions).',
      auth: 'admin',
      body: { id: 'string (required)', '...fields': 'see PUT' },
      response: '{message, data:[Role]}',
    },
    {
      method: 'DELETE',
      path: '/api/admin/role',
      description: 'Delete a non-system role.',
      auth: 'admin',
      body: { id: 'string (required)' },
      response: '{message, data:[]}',
    },
    {
      method: 'GET',
      path: '/api/admin/permission',
      description: 'List all RBAC permissions grouped by category.',
      auth: 'admin',
      response: '{message, data:[Permission]}',
    },

    // ---- Admin: plans / subscriptions / usage ----
    {
      method: 'GET',
      path: '/api/admin/plan',
      description: 'List all subscription plans.',
      auth: 'admin',
      response: '{message, data:[Plan]}',
    },
    {
      method: 'PUT',
      path: '/api/admin/plan',
      description: 'Create a new plan.',
      auth: 'admin',
      body: { name: 'string', monthlyPrice: 'number', maxStorageBytes: 'number', '...flags': 'boolean' },
      response: '{message, data:[Plan]}',
    },
    {
      method: 'PATCH',
      path: '/api/admin/plan',
      description: 'Update an existing plan.',
      auth: 'admin',
      body: { id: 'string (required)', '...fields': 'see PUT' },
      response: '{message, data:[Plan]}',
    },
    {
      method: 'DELETE',
      path: '/api/admin/plan',
      description: 'Delete a non-system plan.',
      auth: 'admin',
      body: { id: 'string (required)' },
      response: '{message, data:[]}',
    },
    {
      method: 'GET',
      path: '/api/admin/subscription',
      description: 'List subscriptions. Use ?expiring=1 for soon-to-expire.',
      auth: 'admin',
      query: { expiring: '"1" (optional)' },
      response: '{message, data:[Subscription]}',
    },
    {
      method: 'PUT',
      path: '/api/admin/subscription',
      description: 'Assign a subscription to a user.',
      auth: 'admin',
      body: { userId: 'string', planId: 'string', expiresAt: 'ISO datetime (optional)' },
      response: '{message, data:[Subscription]}',
    },
    {
      method: 'PATCH',
      path: '/api/admin/subscription',
      description: 'Update a subscription (change plan, extend, cancel).',
      auth: 'admin',
      body: { id: 'string (required)', '...fields': 'see PUT' },
      response: '{message, data:[Subscription]}',
    },
    {
      method: 'DELETE',
      path: '/api/admin/subscription',
      description: 'Cancel/delete a subscription.',
      auth: 'admin',
      body: { id: 'string (required)' },
      response: '{message, data:[]}',
    },
    {
      method: 'GET',
      path: '/api/admin/usage',
      description: 'Per-user usage counters (storage, paste/file counts, monthly, views).',
      auth: 'admin',
      response: '{message, data:[UsageRecord]}',
    },

    // ---- Self-documenting ----
    {
      method: 'GET',
      path: '/api/docs',
      description: 'Returns this documentation (self-describing API).',
      auth: 'none',
      response: '{message, data:[ApiDocs]}',
    },
  ],
}

export async function GET(_req: NextRequest) {
  return ok('API documentation', [DOCS])
}
