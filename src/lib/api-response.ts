import { NextResponse } from 'next/server'

/**
 * Standard API response envelope.
 * `data` is ALWAYS an array (per spec §7.1).
 */
export type ApiEnvelope<T = unknown> = {
  message: string
  data: T[]
}

export function ok<T>(message: string, data: T[] = [], status = 200) {
  return NextResponse.json<ApiEnvelope<T>>({ message, data }, { status })
}

export function created<T>(message: string, data: T[] = []) {
  return NextResponse.json<ApiEnvelope<T>>({ message, data }, { status: 201 })
}

export function badRequest(message: string, data: unknown[] = []) {
  return NextResponse.json<ApiEnvelope>({ message, data }, { status: 400 })
}

export function unauthorized(message = 'Unauthorized', data: unknown[] = []) {
  return NextResponse.json<ApiEnvelope>({ message, data }, { status: 401 })
}

export function forbidden(message = 'Forbidden', data: unknown[] = []) {
  return NextResponse.json<ApiEnvelope>({ message, data }, { status: 403 })
}

export function notFound(message = 'Not found', data: unknown[] = []) {
  return NextResponse.json<ApiEnvelope>({ message, data }, { status: 404 })
}

export function conflict(message: string, data: unknown[] = []) {
  return NextResponse.json<ApiEnvelope>({ message, data }, { status: 409 })
}

export function gone(message = 'Gone', data: unknown[] = []) {
  return NextResponse.json<ApiEnvelope>({ message, data }, { status: 410 })
}

export function unprocessable(message: string, data: unknown[] = []) {
  return NextResponse.json<ApiEnvelope>({ message, data }, { status: 422 })
}

export function tooManyRequests(message = 'Too many requests', data: unknown[] = []) {
  return NextResponse.json<ApiEnvelope>({ message, data }, { status: 429 })
}

export function serverError(message = 'Internal server error', data: unknown[] = []) {
  return NextResponse.json<ApiEnvelope>({ message, data }, { status: 500 })
}

/**
 * Resolve an id from path param, query param, or body (path wins).
 * Per spec §7.3.
 */
export function resolveId(
  params: Record<string, string | string[] | undefined> | undefined,
  query: Record<string, string | string[] | undefined> | undefined,
  body: Record<string, unknown> | undefined
): string | null {
  const p = params?.id
  const q = query?.id
  const b = body?.id
  if (typeof p === 'string' && p) return p
  if (typeof q === 'string' && q) return q
  if (typeof b === 'string' && b) return b
  return null
}
