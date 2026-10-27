import type { SafeUser } from '@/lib/types'

type UserRow = {
  id: string
  email: string
  displayName: string | null
  role: string
  status: string
  emailVerifiedAt: Date | null
  apiKey: string | null
  createdAt: Date
}

/**
 * The full user record — includes the API key, so only return it to the
 * user themself (or an admin). Never use it for public profile lookups.
 */
export function toSafeUser(u: UserRow, pasteCount?: number): SafeUser {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
    status: u.status as SafeUser['status'],
    emailVerifiedAt: u.emailVerifiedAt ? u.emailVerifiedAt.toISOString() : null,
    apiKey: u.apiKey,
    createdAt: u.createdAt.toISOString(),
    ...(pasteCount !== undefined ? { pasteCount } : {}),
  }
}

/** What anyone may see about another user. */
export function toPublicUser(u: { id: string; displayName: string | null; createdAt: Date }) {
  return {
    id: u.id,
    displayName: u.displayName || 'Member',
    createdAt: u.createdAt.toISOString(),
  }
}
