/**
 * Frontend API client.
 * Every call returns the unwrapped `data` array (or throws on error envelope).
 * Per spec §7.1 — `data` is ALWAYS an array.
 */
import type { SafePaste, SafeUser, SafeAuditLog } from '@/lib/types'

type Envelope<T> = { message: string; data: T[] }

// Unlock tokens returned by POST /api/paste/unlock. The server also sets an
// httpOnly cookie, so this is a fallback for browsers that block cookies.
const unlockTokens = new Map<string, string>()

export function rememberUnlockToken(pasteId: string, token: string) {
  unlockTokens.set(pasteId, token)
}

function unlockHeader(): string {
  return [...unlockTokens.values()].slice(-20).join(',')
}

/** Absolute share URL for a paste (clean /p/<slug> form). */
export function shareUrl(slug: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/p/${slug}`
}

/** Absolute raw URL for a text paste. */
export function rawUrl(slug: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/raw/${slug}`
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
  if (unlockTokens.size > 0 && !headers['x-unlock-token']) {
    headers['x-unlock-token'] = unlockHeader()
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
    request<{ token?: string; link?: string }>('POST', '/api/auth/forgot-password', { body: { email } }),
  resetPassword: (token: string, password: string) =>
    request<unknown>('POST', '/api/auth/reset-password', { body: { token, password } }),

  // User
  updateProfile: (patch: { displayName?: string; currentPassword?: string; newPassword?: string; regenerateApiKey?: boolean; revokeApiKey?: boolean }) =>
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
  }) => request<SafePaste & { url: string; rawUrl: string }>('PUT', '/api/paste', { body }),

  updatePaste: (id: string, patch: Record<string, unknown>) =>
    request<SafePaste>('PATCH', '/api/paste', { body: { id, ...patch } }),

  deletePaste: (id: string) =>
    request<unknown>('DELETE', '/api/paste', { body: { id } }),

  getPaste: (idOrSlug: string) =>
    request<SafePaste>('GET', `/api/paste?id=${encodeURIComponent(idOrSlug)}`),
  /** Metadata only — never counts a view or burns the paste. */
  peekPaste: (idOrSlug: string) =>
    request<SafePaste>('GET', `/api/paste?id=${encodeURIComponent(idOrSlug)}&peek=1`),
  reportPaste: (id: string, reason: string, details?: string) =>
    request<{ id: string; reason: string }>('POST', '/api/paste/report', { body: { id, reason, details } }),

  listPastes: (params: { scope?: string; q?: string; language?: string; type?: string; tag?: string; page?: number; pageSize?: number } = {}) => {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) sp.set(k, String(v))
    return request<SafePaste>('GET', `/api/paste?${sp.toString()}`)
  },

  /** Verify a paste password; the returned token is remembered automatically. */
  unlockPaste: async (id: string, password: string) => {
    const rows = await request<{ id: string; slug: string; unlocked: boolean; token: string; expiresAt: string }>(
      'POST', '/api/paste/unlock', { body: { id, password } },
    )
    if (rows[0]?.token) rememberUnlockToken(rows[0].id, rows[0].token)
    return rows
  },

  // File
  uploadFile: (formData: FormData) =>
    request<SafePaste & { url: string; rawUrl: string }>('PUT', '/api/file', { formData }),
  fileMeta: (idOrSlug: string) =>
    request<SafePaste>('GET', `/api/file?id=${encodeURIComponent(idOrSlug)}&meta=1`),
  /** Upload with progress reporting (fetch can't report upload progress). */
  uploadFileWithProgress: (formData: FormData, onProgress: (fraction: number) => void) =>
    new Promise<(SafePaste & { url: string; rawUrl: string })[]>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', '/api/file')
      xhr.withCredentials = true
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total)
      }
      xhr.onerror = () => reject(new ApiError('Network error during upload', 0))
      xhr.onload = () => {
        let json: Envelope<SafePaste & { url: string; rawUrl: string }>
        try {
          json = JSON.parse(xhr.responseText)
        } catch {
          reject(new ApiError(`Upload failed (HTTP ${xhr.status})`, xhr.status))
          return
        }
        if (xhr.status >= 400) reject(new ApiError(json.message || `HTTP ${xhr.status}`, xhr.status, json.data || []))
        else resolve(json.data || [])
      }
      xhr.send(formData)
    }),
  /** Download URL (attachment). Counts a view; burns burn-after-read files. */
  fileDownloadUrl: (idOrSlug: string) => `/api/file?id=${encodeURIComponent(idOrSlug)}`,
  /** Inline preview URL (safe types only, no view counted). */
  filePreviewUrl: (idOrSlug: string) => `/api/file?id=${encodeURIComponent(idOrSlug)}&inline=1`,
  /** Fetch file bytes once (used for burn-after-read files). */
  fetchFileBlob: async (idOrSlug: string): Promise<Blob> => {
    const res = await fetch(`/api/file?id=${encodeURIComponent(idOrSlug)}`, {
      credentials: 'include',
      headers: unlockTokens.size ? { 'x-unlock-token': unlockHeader() } : {},
    })
    if (!res.ok) {
      let message = `HTTP ${res.status}`
      try {
        message = ((await res.json()) as { message?: string }).message || message
      } catch {
        /* non-JSON error */
      }
      throw new ApiError(message, res.status)
    }
    return res.blob()
  },

  // Languages
  listLanguages: () => request<{ language: string; count: number }>('GET', '/api/languages'),

  // Public site settings (non-sensitive)
  getSettings: () => request<Record<string, unknown>>('GET', '/api/settings'),

  // My plan & limits
  myLimits: () =>
    request<{
      user: { id: string; email: string; displayName: string | null; role: string; roleId: string | null }
      plan: {
        name: string; planId: string; maxStorageBytes: number; maxPasteSize: number
        maxPastesPerMonth: number; allowedExpiryPresets: string[]
        allowCustomExpiry: boolean; allowBurnAfterRead: boolean; allowPassword: boolean
        allowPrivate: boolean; allowFileUpload: boolean
      }
      subscription: {
        id: string; status: string; startedAt: string; expiresAt: string | null
        planName: string; monthlyPrice: number
      } | null
      usage: {
        storageBytes: number; pasteCount: number; fileCount: number
        monthPasteCount: number; totalPastes: number; totalViews: number
      }
    }>('GET', '/api/me/limits'),

  // Ads (public)
  listAds: (slot?: string) =>
    request<{
      id: string; name: string; slot: string; adType: string
      content: string; imageUrl: string | null; linkUrl: string | null
    }>('GET', slot ? `/api/ads?slot=${encodeURIComponent(slot)}` : '/api/ads'),
  adClick: (id: string) =>
    request<unknown>('POST', '/api/ads/click', { body: { id } }),

  // Admin
  admin: {
    listUsers: (q?: string, status?: string) => {
      const sp = new URLSearchParams()
      if (q) sp.set('q', q)
      if (status) sp.set('status', status)
      return request<SafeUser & { pasteCount?: number }>('GET', `/api/admin/user?${sp.toString()}`)
    },
    createUser: (body: { email: string; password: string; displayName?: string; role?: string; roleId?: string; status?: string; autoVerify?: boolean }) =>
      request<SafeUser>('PUT', `/api/admin/user`, { body }),
    updateUser: (id: string, patch: { status?: string; role?: string; roleId?: string | null; displayName?: string; email?: string; password?: string; verify?: boolean; regenerateApiKey?: boolean }) =>
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
    clearAudit: () =>
      request<unknown>('DELETE', '/api/admin/audit'),

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

    // RBAC
    listRoles: () =>
      request<{
        id: string; name: string; description: string | null; color: string | null;
        isSystem: boolean; userCount: number; createdAt: string;
        permissions: { id: string; name: string; description: string | null; category: string }[]
      }>('GET', '/api/admin/role'),
    createRole: (body: { name: string; description?: string; color?: string; permissionIds?: string[] }) =>
      request<{ id: string; name: string }>('PUT', '/api/admin/role', { body }),
    updateRole: (id: string, patch: Record<string, unknown>) =>
      request<{ id: string; name: string }>('PATCH', '/api/admin/role', { body: { id, ...patch } }),
    deleteRole: (id: string) =>
      request<unknown>('DELETE', '/api/admin/role', { body: { id } }),

    listPermissions: () =>
      request<{ id: string; name: string; description: string | null; category: string }>('GET', '/api/admin/permission'),

    // Plans
    listPlans: () =>
      request<{
        id: string; name: string; description: string | null; monthlyPrice: number;
        maxStorageBytes: number; maxPasteSize: number; maxPastesPerMonth: number;
        allowedExpiryPresets: string[]; allowCustomExpiry: boolean; allowBurnAfterRead: boolean;
        allowPassword: boolean; allowPrivate: boolean; allowFileUpload: boolean;
        isSystem: boolean; isActive: boolean; sortOrder: number; createdAt: string;
      }>('GET', '/api/admin/plan'),
    createPlan: (body: Record<string, unknown>) =>
      request<unknown>('PUT', '/api/admin/plan', { body }),
    updatePlan: (id: string, patch: Record<string, unknown>) =>
      request<unknown>('PATCH', '/api/admin/plan', { body: { id, ...patch } }),
    deletePlan: (id: string) =>
      request<unknown>('DELETE', '/api/admin/plan', { body: { id } }),

    // Subscriptions
    listSubscriptions: (status?: string) => {
      const q = status ? `?status=${status}` : ''
      return request<{
        id: string; userId: string; planId: string; status: string;
        startedAt: string; expiresAt: string | null; createdAt: string;
        user: { id: string; email: string; displayName: string | null } | null;
        plan: { id: string; name: string; monthlyPrice: number } | null;
      }>('GET', `/api/admin/subscription${q}`)
    },
    listExpiringSubscriptions: () =>
      request<{
        id: string; userId: string; planId: string; status: string;
        startedAt: string; expiresAt: string | null; createdAt: string;
        user: { id: string; email: string; displayName: string | null } | null;
        plan: { id: string; name: string; monthlyPrice: number } | null;
      }>('GET', '/api/admin/subscription?expiring=1'),
    assignSubscription: (body: { userId: string; planId: string; expiresAt?: string | null }) =>
      request<unknown>('PUT', '/api/admin/subscription', { body }),
    updateSubscription: (id: string, patch: Record<string, unknown>) =>
      request<unknown>('PATCH', '/api/admin/subscription', { body: { id, ...patch } }),
    cancelSubscription: (id: string) =>
      request<unknown>('DELETE', '/api/admin/subscription', { body: { id } }),

    // Usage
    listUsage: () =>
      request<{
        user: { id: string; email: string; displayName: string | null; role: string; status: string }
        subscription: { id: string; status: string; expiresAt: string | null; plan: { id: string; name: string; maxStorageBytes: number } } | null
        usage: { storageBytes: number; pasteCount: number; fileCount: number; monthPasteCount: number; totalPastes: number; totalViews: number }
      }>('GET', '/api/admin/usage'),

    // Trending
    trending: (limit = 10, days = 7) =>
      request<SafePaste>('GET', `/api/admin/trending?limit=${limit}&days=${days}`),

    // Content CRUD (enhanced — supports title/desc/tags/language/textContent/viewCount/resetViews)
    editPaste: (id: string, patch: Record<string, unknown>) =>
      request<SafePaste>('PATCH', '/api/admin/paste', { body: { id, ...patch } }),

    // Ads
    listAds: () =>
      request<{
        id: string; name: string; slot: string; adType: string; content: string
        imageUrl: string | null; linkUrl: string | null; isActive: boolean
        impressions: number; clicks: number; startsAt: string | null
        endsAt: string | null; createdAt: string
      }>('GET', '/api/admin/ad'),
    getAd: (id: string) =>
      request<{
        id: string; name: string; slot: string; adType: string; content: string
        imageUrl: string | null; linkUrl: string | null; isActive: boolean
        impressions: number; clicks: number; startsAt: string | null
        endsAt: string | null; createdAt: string; updatedAt: string
      }>('GET', `/api/admin/ad/${id}`),
    createAd: (body: Record<string, unknown>) =>
      request<unknown>('PUT', '/api/admin/ad', { body }),
    updateAd: (id: string, patch: Record<string, unknown>) =>
      request<unknown>('PATCH', '/api/admin/ad', { body: { id, ...patch } }),
    deleteAd: (id: string) =>
      request<unknown>('DELETE', '/api/admin/ad', { body: { id } }),

    // Payments
    listPayments: (status?: string) =>
      request<{
        id: string; userId: string
        user: { email: string; displayName: string | null } | null
        planId: string
        plan: { name: string; monthlyPrice: number } | null
        amount: number; currency: string; status: string; method: string
        txnId: string | null; invoiceNumber: string | null
        notes: string | null; createdAt: string
      }>('GET', status ? `/api/admin/payment?status=${encodeURIComponent(status)}` : '/api/admin/payment'),
    createPayment: (body: {
      userId: string; planId: string; amount: number
      method?: string; txnId?: string; notes?: string; status?: string
    }) => request<unknown>('PUT', '/api/admin/payment', { body }),
    updatePayment: (id: string, patch: Record<string, unknown>) =>
      request<unknown>('PATCH', '/api/admin/payment', { body: { id, ...patch } }),
    deletePayment: (id: string) =>
      request<unknown>('DELETE', '/api/admin/payment', { body: { id } }),

    // Invoices
    listInvoices: (userId?: string) =>
      request<{
        id: string; number: string; paymentId: string; userId: string
        user: { email: string; displayName: string | null } | null
        amount: number; currency: string; planName: string
        periodStart: string; periodEnd: string | null
        status: string; createdAt: string
      }>('GET', userId ? `/api/admin/invoice?userId=${encodeURIComponent(userId)}` : '/api/admin/invoice'),
    getInvoice: (id: string) =>
      request<{
        invoice: {
          id: string; number: string; paymentId: string; userId: string
          amount: number; currency: string; planName: string
          periodStart: string; periodEnd: string | null
          status: string; pdfKey: string | null; createdAt: string
        }
        user: { id: string; email: string; displayName: string | null; role: string } | null
        payment: {
          id: string; amount: number; currency: string; status: string
          method: string; txnId: string | null; invoiceNumber: string | null
          notes: string | null; subscriptionId: string | null; createdAt: string
          plan: { id: string; name: string; monthlyPrice: number } | null
        } | null
      }>('GET', `/api/admin/invoice/${id}`),
  },
}
