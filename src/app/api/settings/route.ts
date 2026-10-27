import { NextRequest } from 'next/server'
import { ok } from '@/lib/api-response'
import { getSettings } from '@/lib/paste-utils'

/**
 * GET /api/settings — public site settings (only non-sensitive keys).
 * Returns branding, SEO, and display-related settings for the frontend.
 * Does NOT return secrets (captchaSecretKey, apiKey, smtp, etc.).
 */
export async function GET(_req: NextRequest) {
  const all = await getSettings()

  // Only expose non-sensitive settings
  const safe: Record<string, unknown> = {
    siteName: all.siteName ?? 'PasteShare',
    tagline: all.tagline ?? 'Share code & files with syntax-highlighted links.',
    logoUrl: all.logoUrl ?? '/logo.svg',
    faviconUrl: all.faviconUrl ?? '/logo.svg',
    // SEO
    metaTitleTemplate: all.metaTitleTemplate ?? '{title} — PasteShare',
    metaDescriptionTemplate: all.metaDescriptionTemplate ?? 'A public paste on PasteShare.',
    metaKeywords: all.metaKeywords ?? '',
    canonicalUrl: all.canonicalUrl ?? '',
    ogType: all.ogType ?? 'website',
    ogImage: all.ogImage ?? '',
    twitterCard: all.twitterCard ?? 'summary_large_image',
    twitterSite: all.twitterSite ?? '',
    // Social
    socialLinks: all.socialLinks ?? {},
    // Feature flags (public)
    captchaEnabled: all.captchaEnabled ?? false,
    captchaProvider: all.captchaProvider ?? 'none',
    captchaSiteKey: all.captchaSiteKey ?? '',
    adsEnabled: all.adsEnabled ?? false,
    adsenseClient: all.adsenseClient ?? '',
    guestPostingEnabled: all.guestPostingEnabled ?? true,
    registrationEnabled: all.registrationEnabled ?? true,
    // Upload / paste defaults the create form needs
    defaultExpiry: all.defaultExpiry ?? 'never',
    maxFileSizeBytes: all.maxFileSizeBytes ?? 25 * 1024 * 1024,
    allowedFileTypes: all.allowedFileTypes ?? '*',
  }

  return ok('Site settings', [safe])
}
