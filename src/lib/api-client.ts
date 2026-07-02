/**
 * Frontend API client.
 * Every call returns the unwrapped `data` array (or throws on error envelope).
 * Per spec §7.1 — `data` is ALWAYS an array.
 */
import type { SafePaste, SafeUser, SafeAuditLog } from '@/lib/types'

type Envelope<T> = { message: string; data: T[] }

let unlockedPasteIds: Set<string> = new Set()

export function markUnlocked(pasteId: string) {
  unlockedPasteIds.add(pasteId)
}

export function getUnlockedHeader(): string {
  return [...unlockedPasteIds].join(',')
}

export class ApiError extends Error {
  status: number
  data: unknown[]
  constructor(message: string, status: number, data: unknown[] = []) {
    super(message)
    this.status = status
    this.data = data
  }
}

async function request<T>(
  method: string,
  url: string,
  opts: { body?: unknown; formData?: FormData; headers?: Record<string, string> } = {}
): Promise<T[]> {
  const headers: Record<string, string> = {
    ...(opts.headers || {}),
  }
  if (unlockedPasteIds.size > 0 && !headers['x-unlocked']) {
    headers['x-unlocked'] = getUnlockedHeader()
  }
  let body: BodyInit | undefined
  if (opts.formData) {
    body = opts.formData
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.body)
  }
  const res = await fetch(url, { method, headers, body, credentials: 'include' })
  const text = await res.text()
  let json: Envelope<T>
  try {
    json = JSON.parse(text) as Envelope<T>
  } catch {
    throw new ApiError(`Invalid JSON response: ${text.slice(0, 200)}`, res.status)
  }
  if (!res.ok) {
    throw new ApiError(json.message || `HTTP ${res.status}`, res.status, json.data || [])
  }
  return json.data || []
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<SafeUser & { passwordRequired?: boolean }>('POST', '/api/auth/login', { body: { email, password } }),
  logout: () => request<unknown>('POST', '/api/auth/logout'),
  me: () => request<SafeUser>('GET', '/api/auth/me'),
  refresh: () => request<SafeUser>('POST', '/api/auth/refresh'),
  register: (email: string, password: string, displayName?: string) =>
    request<SafeUser>('PUT', '/api/user', { body: { email, password, displayName } }),
  forgotPassword: (email: string) =>
    request<{ token: string }>('POST', '/api/auth/forgot-password', { body: { email } }),
  resetPassword: (token: string, password: string) =>
    request<unknown>('POST', '/api/auth/reset-password', { body: { token, password } }),

  // User
  updateProfile: (patch: { displayName?: string; currentPassword?: string; newPassword?: string; regenerateApiKey?: boolean }) =>
    request<SafeUser>('PATCH', '/api/user', { body: patch }),
  deleteAccount: (currentPassword: string) =>
    request<unknown>('DELETE', '/api/user', { body: { currentPassword } }),

  // Paste
  createPaste: (body: {
    title?: string
    description?: string
    tags?: string
    language?: string
    textContent: string
    visibility?: string
    password?: string
    burnAfterRead?: boolean
    expiryPreset?: string
    expiryCustom?: string
  }) => request<SafePaste>('PUT', '/api/paste', { body }),

  updatePaste: (id: string, patch: Record<string, unknown>) =>
    request<SafePaste>('PATCH', '/api/paste', { body: { id, ...patch } }),

  deletePaste: (id: string) =>
    request<unknown>('DELETE', '/api/paste', { body: { id } }),

  getPaste: (idOrSlug: string) =>
    request<SafePaste & { passwordRequired?: boolean }>('GET', `/api/paste?id=${encodeURIComponent(idOrSlug)}`),

  listPastes: (params: { scope?: string; q?: string; language?: string; page?: number; pageSize?: number } = {}) => {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) sp.set(k, String(v))
    return request<SafePaste>('GET', `/api/paste?${sp.toString()}`)
  },

  unlockPaste: (id: string, password: string) =>
    request<{ id: string; unlocked: boolean }>('POST', '/api/paste/unlock', { body: { id, password } }),

  // File
  uploadFile: (formData: FormData) =>
    request<SafePaste>('PUT', '/api/file', { formData }),
  fileMeta: (idOrSlug: string) =>
    request<SafePaste & { passwordRequired?: boolean }>('GET', `/api/file?id=${encodeURIComponent(idOrSlug)}&meta=1`),
  fileDownloadUrl: (idOrSlug: string) => `/api/file?id=${encodeURIComponent(idOrSlug)}`,

  // Languages
  listLanguages: () => request<{ language: string; count: number }>('GET', '/api/languages'),

  // Admin
  admin: {
    listUsers: (q?: string, status?: string) => {
      const sp = new URLSearchParams()
      if (q) sp.set('q', q)
      if (status) sp.set('status', status)
      return request<SafeUser & { pasteCount?: number }>('GET', `/api/admin/user?${sp.toString()}`)
    },
    updateUser: (id: string, patch: { status?: string; role?: string; displayName?: string; verify?: boolean }) =>
      request<SafeUser>('PATCH', `/api/admin/user`, { body: { id, ...patch } }),
    deleteUser: (id: string) =>
      request<unknown>('DELETE', `/api/admin/user`, { body: { id } }),

    listPastes: (params: { q?: string; flagged?: boolean; expired?: boolean } = {}) => {
      const sp = new URLSearchParams()
      if (params.q) sp.set('q', params.q)
      if (params.flagged) sp.set('flagged', '1')
      if (params.expired) sp.set('expired', '1')
      return request<SafePaste>('GET', `/api/admin/paste?${sp.toString()}`)
    },
    updatePaste: (id: string, patch: { isFlagged?: boolean; visibility?: string; forceExpire?: boolean; expiresAt?: string | null; title?: string }) =>
      request<SafePaste>('PATCH', `/api/admin/paste`, { body: { id, ...patch } }),
    deletePaste: (id: string) =>
      request<unknown>('DELETE', `/api/admin/paste`, { body: { id } }),

    getSettings: () => request<Record<string, unknown>>('GET', '/api/admin/settings'),
    updateSettings: (patch: Record<string, unknown>) =>
      request<Record<string, unknown>>('PATCH', '/api/admin/settings', { body: patch }),

    listAudit: (limit = 100) =>
      request<SafeAuditLog>('GET', `/api/admin/audit?limit=${limit}`),

    analytics: () =>
      request<{
        totalUsers: number
        totalPastes: number
        totalFiles: number
        totalActivePastes: number
        flaggedCount: number
        burnedCount: number
        totalViews: number
        storageUsedBytes: number
        topLanguages: { language: string; count: number }[]
        traffic: { date: string; count: number }[]
      }>('GET', '/api/admin/analytics'),
  },
}
