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
  types: {
    SafePaste: {
      id: 'string',
      slug: 'string — short shareable code (6-8 chars)',
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
    },
    SafeUser: {
      id: 'string',
      email: 'string',
      displayName: 'string | null',
      role: '"user" | "admin"',
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
        'Create a new text paste. Body is scanned for spam/malware signatures (XSS, SQL injection, etc.). Plan limits (maxPasteSize, maxPastesPerMonth, feature flags) are enforced.',
      auth: 'optional',
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
        'List public/own/trending pastes, or fetch a single paste by id or slug. Single-paste fetch increments the view counter and may trigger burn-after-read hard-delete.',
      auth: 'optional',
      queryParams: {
        id: 'paste id or slug — when present, returns a single paste',
        scope: '"public" (default) | "own" | "trending" | "language"',
        language: 'filter by language (with scope=language)',
        q: 'full-text search across title/description/content/tags/language',
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
      description: 'Update an existing paste (owner or admin only). Pass id in body or query.',
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
        'Raw plain-text body of a text paste (NOT wrapped in the standard envelope). Use for embedding or CLI downloads.',
      auth: 'optional',
      queryParams: { id: 'paste id or slug (required)' },
      successResponse: 'function greet(name: string): string {\n  return `Hello, ${name}!`\n}',
      errorResponse: { 403: { message: 'Password required — POST /api/paste/unlock first', data: [] } },
    },
    {
      method: 'POST',
      path: '/api/paste/unlock',
      description:
        'Verify a paste password. On 200, the client may re-request the paste with the `x-unlocked: <pasteId>` header to receive the content.',
      auth: 'optional',
      requestBody: { id: 'k3Xy9a', password: 'secret123' },
      successResponse: { message: 'Paste unlocked', data: [{ id: 'cmr2abc...', unlocked: true }] },
      errorResponse: { 401: { message: 'Incorrect password', data: [] } },
    },

    // ---- File upload ----
    {
      method: 'PUT',
      path: '/api/file',
      description:
        'Multipart/form-data file upload. Scans file name + bytes for malware (blocks executables, macro-enabled documents, double extensions). Enforces plan storage + size limits.',
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
        'Download a file by id/slug (streams raw bytes with Content-Disposition: attachment). Use ?meta=1 for metadata only (respects password gate; returns SafePaste in the standard envelope).',
      auth: 'optional',
      queryParams: { id: 'paste id or slug (required)', meta: '"1" for metadata only' },
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
      description: 'Request a password reset email (sandbox: returns the reset token directly in the response).',
      auth: 'none',
      requestBody: { email: 'user@example.com' },
      successResponse: {
        message: 'Reset token generated (dev mode returns it directly)',
        data: [{ token: 'a1b2c3d4e5f6...' }],
      },
    },
    {
      method: 'POST',
      path: '/api/auth/reset-password',
      description: 'Reset password using a reset token obtained from forgot-password.',
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
      description: 'Fetch own profile (default), or a specific user by id (?id=<userId>).',
      auth: 'required',
      queryParams: { id: 'string (optional — fetch a specific user by id)' },
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
        'Update own profile. Can change displayName, password (requires currentPassword), or regenerate the API key.',
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
      description: 'Permanently delete own account (requires currentPassword for confirmation).',
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
        'Run background cleanup — hard-deletes expired + burned pastes (removes DB records + storage files + creates audit log entries). Can be called by a cron scheduler.',
      auth: 'none',
      successResponse: {
        message: 'Cleanup completed',
        data: [{ expired: 3, burned: 1 }],
      },
    },
    {
      method: 'POST',
      path: '/api/cron/subscriptions',
      description:
        'Run subscription maintenance — marks overdue subscriptions as expired, logs soon-to-expire subscriptions. Can be called by a cron scheduler.',
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
