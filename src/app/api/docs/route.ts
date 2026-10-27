import { NextRequest } from 'next/server'
import { ok } from '@/lib/api-response'

/**
 * GET /api/docs — self-documenting API documentation.
 *
 * Returns a structured description of every PUBLIC endpoint (admin endpoints
 * are excluded — they require the admin role and are documented separately in
 * the project README). Each endpoint includes:
 *   - method, path, description, auth level
 *   - requestBody (example JSON)
 *   - queryParams (example)
 *   - successResponse (example JSON)
 *   - errorResponse (example JSON)
 *
 * External apps can fetch this to bootstrap client bindings.
 */

type EndpointDoc = {
  method: 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  description: string
  auth: 'none' | 'optional' | 'required'
  requestBody?: Record<string, unknown>
  queryParams?: Record<string, string>
  successResponse: unknown
  errorResponse?: unknown
}

type StatusCodeDoc = { code: number; meaning: string }

type ApiDocs = {
  baseUrl: string
  auth: { type: string; description: string }
  apiKey: { header: string; description: string }
  responseFormat: { message: string; data: string }
  statusCodes: StatusCodeDoc[]
  types: Record<string, Record<string, string>>
  endpoints: EndpointDoc[]
}

const DOCS: ApiDocs = {
  baseUrl: '/',
  auth: {
    type: 'session_cookie',
    description:
      'Authentication uses a signed HMAC session token stored in the httpOnly `ps_session` cookie (7-day TTL). Obtain it via POST /api/auth/login or PUT /api/user (register). Sessions are re-validated on every request: banning a user, or changing/resetting their password, signs them out everywhere immediately. Non-browser clients should use the API key mechanism below.',
  },
  apiKey: {
    header: 'x-api-key',
    description:
      'Send a user API key as `x-api-key: ps_<hex>` or `Authorization: Bearer ps_<hex>`. Generate one from the dashboard (PATCH /api/user with { regenerateApiKey: true }; revoke with { revokeApiKey: true }). API key auth works on every endpoint that accepts a session. Keys are rate-limited per minute (site setting `apiRateLimit`; responses carry X-RateLimit-Limit / X-RateLimit-Remaining, and 429 + Retry-After when exceeded) and rejected with 403 when the admin disables the API (`apiEnabled`).',
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
  types: {
    SafePaste: {
      id: 'string',
      slug: 'string — short shareable code (8 chars for new pastes; older pastes may have 6)',
      title: 'string | null',
      description: 'string | null',
      tags: 'string[]',
      contentType: '"text" | "file"',
      language: 'string (e.g. "typescript")',
      visibility: '"public" | "unlisted" | "private"',
      hasPassword: 'boolean',
      burnAfterRead: 'boolean',
      isBurned: 'boolean',
      viewCount: 'number',
      expiresAt: 'ISO datetime | null',
      isExpired: 'boolean',
      isFlagged: 'boolean',
      createdAt: 'ISO datetime',
      updatedAt: 'ISO datetime',
      ownerId: 'string | null',
      ownerName: 'string | null',
      originalFileName: 'string | null (file only)',
      mimeType: 'string | null (file only)',
      fileSizeBytes: 'number | null (file only)',
      textContent: 'string | null (text only, included when authorised)',
      sizeBytes: 'number — text byte length or file size',
      lineCount: 'number (text only)',
      preview: 'string (listings only — first ~240 chars of unlocked text pastes)',
      passwordRequired: 'boolean (single-paste responses — unlock first)',
      burnPending: 'boolean (single-paste responses — reading/downloading will destroy it)',
      isOwner: 'boolean (single-paste responses)',
    },
    SafeUser: {
      id: 'string',
      email: 'string',
      displayName: 'string | null',
      role: '"user" | "moderator" | "admin" | <custom role name>',
      status: '"active" | "suspended" | "banned" | "pending_verification"',
      emailVerifiedAt: 'ISO datetime | null',
      apiKey: 'string | null (ps_<hex>)',
      createdAt: 'ISO datetime',
    },
  },
  endpoints: [
    // ---- Paste (text) ----
    {
      method: 'PUT',
      path: '/api/paste',
      description:
        'Create a new text paste (POST is an alias). JSON body, or a raw `text/plain` body with the options as query params — e.g. `curl --data-binary @file.py "/api/paste?language=python&expiryPreset=1d&format=url"`. `?format=url` returns just the share URL as text. Plan limits (maxPasteSize, maxPastesPerMonth, feature flags) and the banned-word/spam scanner apply. The response includes `url` (/p/<slug>) and `rawUrl` (/raw/<slug>).',
      auth: 'optional',
      queryParams: {
        format: '"url" → respond with the share URL as text/plain',
        'title, language, visibility, password, burnAfterRead, expiryPreset, expiryCustom, tags':
          'options when sending a text/plain body',
      },
      requestBody: {
        title: 'My Code Snippet',
        description: 'A useful helper function',
        tags: 'javascript, utility, helper',
        language: 'typescript',
        textContent: 'function greet(name: string): string {\n  return `Hello, ${name}!`\n}',
        visibility: 'public',
        burnAfterRead: false,
        expiryPreset: 'never',
      },
      successResponse: {
        message: 'Paste created successfully',
        data: [
          {
            id: 'cmr2abc...',
            slug: 'k3Xy9a',
            title: 'My Code Snippet',
            contentType: 'text',
            language: 'typescript',
            visibility: 'public',
            hasPassword: false,
            burnAfterRead: false,
            isBurned: false,
            viewCount: 0,
            expiresAt: null,
            isExpired: false,
            isFlagged: false,
            createdAt: '2026-07-02T12:00:00.000Z',
            updatedAt: '2026-07-02T12:00:00.000Z',
            ownerId: 'cmr2def...',
            ownerName: 'John Doe',
            url: 'https://example.com/p/k3Xy9aQ2',
            rawUrl: 'https://example.com/raw/k3Xy9aQ2',
          },
        ],
      },
      errorResponse: {
        400: { message: 'textContent is required', data: [] },
        403: {
          message: 'Private pastes require a Pro plan or higher (current: Free)',
          data: [],
        },
        422: {
          message: 'Content rejected by spam/malware scanner',
          data: [{ threats: ['xss_script_tag'] }],
        },
      },
    },
    {
      method: 'GET',
      path: '/api/paste',
      description:
        'List public/own/trending pastes, or fetch a single paste by id or slug. A single-paste fetch counts a view and burns burn-after-read text pastes (the owner and moderators never burn or count). Use ?peek=1 to get metadata only — it never burns. Password-protected pastes return `passwordRequired: true` until unlocked. Listings include a short `preview` for unlocked text pastes and an X-Total-Count header.',
      auth: 'optional',
      queryParams: {
        id: 'paste id or slug — when present, returns a single paste',
        peek: '"1" → metadata only, no view counted, never burns (single paste)',
        scope: '"public" (default) | "own" | "trending" | "language"',
        language: 'filter by language (with scope=language)',
        type: '"text" | "file"',
        tag: 'filter by tag',
        q: 'search title/description/tags/language/file name (and content of unlocked pastes)',
        page: 'page number (default 1)',
        pageSize: 'page size (default 20, max 50)',
      },
      successResponse: {
        message: 'Pastes fetched',
        data: [
          {
            id: 'cmr2abc...',
            slug: 'k3Xy9a',
            title: 'My Code Snippet',
            contentType: 'text',
            language: 'typescript',
            visibility: 'public',
            viewCount: 5,
            createdAt: '2026-07-02T12:00:00.000Z',
          },
        ],
      },
      errorResponse: {
        404: { message: 'Paste not found', data: [] },
        410: { message: 'Paste has expired and been permanently deleted', data: [] },
      },
    },
    {
      method: 'PATCH',
      path: '/api/paste',
      description:
        'Update an existing paste (owner, or a moderator with `admin:content`). Pass id in body or query. Editable: title, description, tags, language, textContent, visibility, password (null to remove), burnAfterRead, expiryPreset. Plan limits apply.',
      auth: 'required',
      requestBody: {
        id: 'k3Xy9a',
        title: 'Updated Title',
        visibility: 'private',
        expiryPreset: '1d',
      },
      successResponse: {
        message: 'Paste updated',
        data: [
          {
            id: 'cmr2abc...',
            slug: 'k3Xy9a',
            title: 'Updated Title',
            visibility: 'private',
          },
        ],
      },
      errorResponse: {
        403: { message: 'Not the owner', data: [] },
        404: { message: 'Paste not found', data: [] },
      },
    },
    {
      method: 'DELETE',
      path: '/api/paste',
      description:
        'Permanently delete a paste (owner or admin only). Hard-deletes the record + storage file + access grants.',
      auth: 'required',
      requestBody: { id: 'k3Xy9a' },
      successResponse: { message: 'Paste permanently deleted', data: [] },
      errorResponse: {
        403: { message: 'Not the owner', data: [] },
        404: { message: 'Paste not found', data: [] },
      },
    },
    {
      method: 'GET',
      path: '/api/paste/[id]',
      description:
        'Path-style fetch of a single paste by id or slug. Same access rules as /api/paste?id=.',
      auth: 'optional',
      successResponse: {
        message: 'Paste fetched',
        data: [{ id: 'cmr2abc...', slug: 'k3Xy9a', textContent: 'function greet...' }],
      },
      errorResponse: {
        410: { message: 'Paste was burned after reading and has been permanently deleted', data: [] },
      },
    },
    {
      method: 'GET',
      path: '/api/paste/raw',
      description:
        'Raw plain-text body of a text paste (NOT wrapped in the envelope; errors are plain text too). Also available at the short URL /raw/<slug>. Same access rules as the JSON endpoint, including burn-after-read. Password-protected pastes accept `x-paste-password: <password>`, `x-unlock-token: <token>` or `?token=<token>`.',
      auth: 'optional',
      queryParams: { id: 'paste id or slug (required)', dl: '"1" → download as a file named after the paste', token: 'unlock token' },
      successResponse: 'function greet(name: string): string {\n  return `Hello, ${name}!`\n}',
      errorResponse: { 403: 'Password required. Send it in the x-paste-password header, …' },
    },
    {
      method: 'POST',
      path: '/api/paste/report',
      description:
        'Report abusive content. Flags the paste for moderators (Admin → Content → Flagged) and records the report in the audit log. Rate-limited per IP.',
      auth: 'optional',
      requestBody: { id: 'k3Xy9aQ2', reason: 'spam | malware | phishing | illegal | personal_info | copyright | other', details: 'optional text' },
      successResponse: { message: 'Thanks — the paste was reported to the moderators', data: [{ id: 'cmr2abc...', reason: 'spam' }] },
    },
    {
      method: 'POST',
      path: '/api/paste/unlock',
      description:
        'Verify a paste password. Returns a signed token valid for 1 hour (bound to the current password) and sets an httpOnly `ps_ul_<pasteId>` cookie, so browsers can simply re-request the paste/file. API clients pass the token as `x-unlock-token` or `?token=`. Attempts are rate-limited (10/min per IP and paste).',
      auth: 'optional',
      requestBody: { id: 'k3Xy9a', password: 'secret123' },
      successResponse: {
        message: 'Paste unlocked',
        data: [{ id: 'cmr2abc...', slug: 'k3Xy9aQ2', unlocked: true, token: '1793115398769.4WEk…', expiresAt: '2026-10-27T15:36:38.769Z' }],
      },
      errorResponse: { 401: { message: 'Incorrect password', data: [] }, 429: { message: 'Too many password attempts. Try again in a minute.', data: [] } },
    },

    // ---- File upload ----
    {
      method: 'PUT',
      path: '/api/file',
      description:
        'Multipart/form-data file upload (POST is an alias). Requires a plan with file uploads (guests can\'t upload by default). Scans file name + bytes for malware (executables, macro-enabled documents, double extensions, admin-banned extensions). Enforces the plan per-file and storage limits, the site-wide `maxFileSizeBytes` and `allowedFileTypes`. Supports `?format=url`.',
      auth: 'optional',
      requestBody: {
        _contentType: 'multipart/form-data',
        file: '<Blob> (required)',
        title: 'My Document',
        visibility: 'public',
        expiryPreset: 'never',
      },
      successResponse: {
        message: 'File uploaded successfully',
        data: [
          {
            id: 'cmr2file...',
            slug: 'p8Xy2b',
            contentType: 'file',
            originalFileName: 'report.pdf',
            mimeType: 'application/pdf',
            fileSizeBytes: 1048576,
            visibility: 'public',
          },
        ],
      },
      errorResponse: {
        400: { message: 'File too large (max 26214400 bytes on Pro plan)', data: [] },
        422: {
          message: 'Content rejected by spam/malware scanner',
          data: [{ threats: ['executable_file'] }],
        },
      },
    },
    {
      method: 'GET',
      path: '/api/file',
      description:
        'Download a file by id/slug (Content-Disposition: attachment). ?inline=1 renders safe types (images, audio/video, PDF, text as text/plain) in the browser without counting a view. Every response has `nosniff` and a sandboxing CSP. Supports `Range` requests. Burn-after-read files can be downloaded exactly once (no inline/range). Use ?meta=1 for metadata only.',
      auth: 'optional',
      queryParams: { id: 'paste id or slug (required)', meta: '"1" for metadata only', inline: '"1" for an inline preview', token: 'unlock token for password-protected files' },
      successResponse: 'binary stream (Content-Type: application/pdf, Content-Disposition: attachment)',
      errorResponse: { 410: { message: 'File has expired and been permanently deleted', data: [] } },
    },
    {
      method: 'DELETE',
      path: '/api/file',
      description: 'Permanently delete an uploaded file (owner or admin only). Removes storage object + record.',
      auth: 'required',
      requestBody: { id: 'p8Xy2b' },
      successResponse: { message: 'File permanently deleted', data: [] },
      errorResponse: { 403: { message: 'Not the owner', data: [] } },
    },

    {
      method: 'GET',
      path: '/api/file/zip',
      description:
        'Browse a ZIP archive (also .jar/.docx/.xlsx/…): without `entry`, lists up to 5000 entries; with `entry=<path>`, extracts that one file as a download (stored/deflated entries, max 50 MB). Not available for burn-after-read files.',
      auth: 'optional',
      queryParams: { id: 'paste id or slug (required)', entry: 'path inside the archive to extract' },
      successResponse: {
        message: 'Archive entries',
        data: [{ total: 2, truncated: false, limit: 5000, entries: [{ name: 'src/index.js', isDirectory: false, size: 18, compressedSize: 18, method: 0, encrypted: false, modifiedAt: '2026-10-27T14:24:00.000Z' }] }],
      },
    },
    {
      method: 'GET',
      path: '/api/health',
      description: 'Liveness/readiness probe. 200 with { status: "ok" } when the database answers, 503 otherwise. Not wrapped in the envelope.',
      auth: 'none',
      successResponse: { status: 'ok', db: 'ok', latencyMs: 1, time: '2026-10-27T14:36:36.170Z' },
    },

    // ---- Languages ----
    {
      method: 'GET',
      path: '/api/languages',
      description: 'List distinct languages used across public, non-expired text pastes.',
      auth: 'none',
      successResponse: {
        message: 'Languages fetched',
        data: [
          { language: 'typescript', count: 42 },
          { language: 'python', count: 28 },
          { language: 'javascript', count: 15 },
        ],
      },
    },

    // ---- Auth ----
    {
      method: 'POST',
      path: '/api/auth/login',
      description: 'Authenticate with email + password; sets the `ps_session` httpOnly cookie (7-day TTL).',
      auth: 'none',
      requestBody: { email: 'user@example.com', password: 'mypassword' },
      successResponse: {
        message: 'Login successful',
        data: [
          {
            id: 'cmr2usr...',
            email: 'user@example.com',
            displayName: 'John Doe',
            role: 'user',
            status: 'active',
            apiKey: null,
            createdAt: '2026-07-01T12:00:00.000Z',
          },
        ],
      },
      errorResponse: {
        401: { message: 'Invalid credentials', data: [] },
        403: { message: 'Account banned', data: [] },
        429: { message: 'Too many login attempts. Try again in a minute.', data: [] },
      },
    },
    {
      method: 'POST',
      path: '/api/auth/logout',
      description: 'Clear the session cookie.',
      auth: 'none',
      successResponse: { message: 'Logged out', data: [] },
    },
    {
      method: 'GET',
      path: '/api/auth/me',
      description: 'Fetch the currently authenticated user (from session cookie or x-api-key header).',
      auth: 'required',
      successResponse: {
        message: 'Current user',
        data: [{ id: 'cmr2usr...', email: 'user@example.com', role: 'user' }],
      },
      errorResponse: { 401: { message: 'Not authenticated', data: [] } },
    },
    {
      method: 'POST',
      path: '/api/auth/verify',
      description: 'Mark the current user as email-verified (sandbox auto-verifies on registration).',
      auth: 'required',
      successResponse: { message: 'Email verified', data: [{ id: 'cmr2usr...', verified: true }] },
    },
    {
      method: 'POST',
      path: '/api/auth/refresh',
      description: 'Refresh the session cookie (extends TTL by 7 days).',
      auth: 'required',
      successResponse: { message: 'Session refreshed', data: [{ id: 'cmr2usr...', email: 'user@example.com' }] },
    },
    {
      method: 'POST',
      path: '/api/auth/forgot-password',
      description:
        'Request a password reset. Always answers 200 (no account enumeration). Only a SHA-256 of the 30-minute, single-use token is stored. The link is emailed via src/lib/mailer.ts when configured; in development (or with ALLOW_INSECURE_RESET_TOKENS=1) the token is also returned in the response. Rate-limited per IP.',
      auth: 'none',
      requestBody: { email: 'user@example.com' },
      successResponse: {
        message: 'If the email exists, a reset link has been sent',
        data: ['(development only) { token, link }'],
      },
    },
    {
      method: 'POST',
      path: '/api/auth/reset-password',
      description:
        'Reset password using a reset token obtained from forgot-password. Single use; signs the account out of every existing session.',
      auth: 'none',
      requestBody: { token: 'a1b2c3d4e5f6...', password: 'newpassword123' },
      successResponse: { message: 'Password reset successful', data: [] },
      errorResponse: { 400: { message: 'Reset token has expired', data: [] } },
    },

    // ---- User ----
    {
      method: 'PUT',
      path: '/api/user',
      description: 'Register a new user account; sets the session cookie on success (auto-login).',
      auth: 'none',
      requestBody: {
        email: 'newuser@example.com',
        password: 'securepass123',
        displayName: 'New User',
      },
      successResponse: {
        message: 'User registered successfully',
        data: [{ id: 'cmr2new...', email: 'newuser@example.com', role: 'user', status: 'active' }],
      },
      errorResponse: {
        400: { message: 'Password must be at least 8 characters', data: [] },
        409: { message: 'Email already registered', data: [] },
      },
    },
    {
      method: 'GET',
      path: '/api/user',
      description:
        'Fetch own profile (default, includes your API key). With ?id=<userId> returns only the public profile ({ id, displayName, createdAt }) unless you are an admin. GET /api/user/[id] is the unauthenticated public profile.',
      auth: 'required',
      queryParams: { id: 'string (optional — public profile of another user)' },
      successResponse: {
        message: 'Current user',
        data: [{ id: 'cmr2usr...', email: 'user@example.com', displayName: 'John Doe', role: 'user' }],
      },
      errorResponse: { 401: { message: 'Authentication required', data: [] } },
    },
    {
      method: 'PATCH',
      path: '/api/user',
      description:
        'Update own profile: displayName, password (requires currentPassword; signs out your other sessions), regenerateApiKey or revokeApiKey.',
      auth: 'required',
      requestBody: {
        displayName: 'Updated Name',
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123',
        regenerateApiKey: false,
      },
      successResponse: {
        message: 'Profile updated',
        data: [{ id: 'cmr2usr...', displayName: 'Updated Name', apiKey: 'ps_abc123...' }],
      },
      errorResponse: { 403: { message: 'Current password is incorrect', data: [] } },
    },
    {
      method: 'DELETE',
      path: '/api/user',
      description:
        'Permanently delete own account AND all of its pastes and uploaded files (requires currentPassword). The last remaining admin cannot delete themself.',
      auth: 'required',
      requestBody: { currentPassword: 'mypassword' },
      successResponse: { message: 'Account deleted', data: [] },
      errorResponse: { 403: { message: 'Current password is incorrect', data: [] } },
    },

    // ---- Me ----
    {
      method: 'GET',
      path: '/api/me/limits',
      description: "Current user's plan, subscription, and usage counters (storage, paste counts, views).",
      auth: 'required',
      successResponse: {
        message: 'Your plan & limits',
        data: [
          {
            user: { id: 'cmr2usr...', email: 'user@example.com', role: 'user' },
            plan: {
              name: 'Pro',
              maxStorageBytes: 5368709120,
              maxPasteSize: 26214400,
              maxPastesPerMonth: 500,
              allowCustomExpiry: true,
              allowPrivate: true,
            },
            subscription: {
              id: 'cmr2sub...',
              status: 'active',
              planName: 'Pro',
              monthlyPrice: 9.99,
              expiresAt: '2026-08-01T00:00:00.000Z',
            },
            usage: {
              storageBytes: 1048576,
              pasteCount: 12,
              fileCount: 3,
              monthPasteCount: 5,
              totalPastes: 15,
              totalViews: 248,
            },
          },
        ],
      },
      errorResponse: { 401: { message: 'Authentication required', data: [] } },
    },

    // ---- Ads (public) ----
    {
      method: 'GET',
      path: '/api/ads',
      description:
        'Fetch active ads for a given slot (public, no auth). Increments impression counters. Returns empty array if no active ads.',
      auth: 'none',
      queryParams: { slot: '"header" | "sidebar" | "footer" | "between-cards" | "paste-top" | "paste-bottom"' },
      successResponse: {
        message: 'Ads fetched',
        data: [
          {
            id: 'cmr2ad...',
            name: 'Sidebar Banner',
            slot: 'sidebar',
            adType: 'image',
            content: '<a href="..."><img src="..." /></a>',
            imageUrl: 'https://example.com/banner.png',
            linkUrl: 'https://example.com',
          },
        ],
      },
    },
    {
      method: 'POST',
      path: '/api/ads/click',
      description: 'Track an ad click (increments the click counter). Fire-and-forget from the frontend.',
      auth: 'none',
      requestBody: { id: 'cmr2ad...' },
      successResponse: { message: 'Click tracked', data: [] },
    },

    // ---- Cron ----
    {
      method: 'POST',
      path: '/api/cron/cleanup',
      description:
        'Run background cleanup — hard-deletes expired + burned pastes (records + storage files, audit-logged as "system") and expired reset tokens. GET also works. When CRON_SECRET is set, send it as `Authorization: Bearer <secret>`, `x-cron-secret` or `?key=`.',
      auth: 'none',
      successResponse: {
        message: 'Cleanup completed',
        data: [{ expired: 3, burned: 1, resetTokens: 0 }],
      },
    },
    {
      method: 'POST',
      path: '/api/cron/subscriptions',
      description:
        'Run subscription maintenance — marks overdue subscriptions as expired, logs soon-to-expire subscriptions. Protected by CRON_SECRET when set (same as /api/cron/cleanup).',
      auth: 'none',
      successResponse: {
        message: 'Subscription maintenance completed',
        data: [{ expired: 2, expiringSoon: 5 }],
      },
    },

    // ---- Self-documenting ----
    {
      method: 'GET',
      path: '/api/docs',
      description: 'Returns this documentation (self-describing API). External apps can fetch to bootstrap client bindings.',
      auth: 'none',
      successResponse: {
        message: 'API documentation',
        data: [{ baseUrl: '/', auth: { type: 'session_cookie' }, endpoints: '...' }],
      },
    },
  ],
}

export async function GET(_req: NextRequest) {
  return ok('API documentation', [DOCS])
}
