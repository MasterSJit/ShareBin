import { NextRequest } from 'next/server'

/**
 * Robustly parse a JSON request body.
 * Handles empty bodies, partial reads, and stream-consumption edge cases
 * that can happen with Next.js route handlers.
 */
export async function parseJsonBody<T = Record<string, unknown>>(
  req: NextRequest
): Promise<{ data: T | null; error: string | null }> {
  try {
    const text = await req.text()
    if (!text || text.trim() === '') {
      return { data: {} as T, error: null }
    }
    const data = JSON.parse(text) as T
    return { data, error: null }
  } catch (e) {
    return { data: null, error: 'Invalid JSON: ' + (e as Error).message }
  }
}
