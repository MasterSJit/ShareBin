/**
 * Public representation of a paste — never includes passwordHash,
 * storageKey internals, or owner email.
 */
export type SafePaste = {
  id: string
  slug: string
  title: string | null
  description: string | null
  tags: string[]
  contentType: 'text' | 'file'
  language: string
  visibility: 'public' | 'unlisted' | 'private'
  hasPassword: boolean
  burnAfterRead: boolean
  isBurned: boolean
  viewCount: number
  expiresAt: string | null
  isExpired: boolean
  isFlagged: boolean
  createdAt: string
  updatedAt: string
  ownerId: string | null
  ownerName: string | null
  // File-only fields
  originalFileName?: string | null
  mimeType?: string | null
  fileSizeBytes?: number | null
  // Text-only — only included when caller is authorised to read content
  textContent?: string | null
}

export type SafeUser = {
  id: string
  email: string
  displayName: string | null
  role: 'user' | 'admin'
  status: 'pending_verification' | 'active' | 'suspended' | 'banned'
  emailVerifiedAt: string | null
  apiKey: string | null
  createdAt: string
  pasteCount?: number
}

export type SafeAuditLog = {
  id: string
  adminId: string
  adminEmail: string | null
  action: string
  targetType: string
  targetId: string
  metadata: unknown
  createdAt: string
}
