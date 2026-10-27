'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { api } from '@/lib/api-client'

type PublicSettings = {
  siteName: string
  tagline: string
  logoUrl: string
  faviconUrl: string
  metaTitleTemplate: string
  metaDescriptionTemplate: string
  metaKeywords: string
  canonicalUrl: string
  ogType: string
  ogImage: string
  twitterCard: string
  twitterSite: string
  socialLinks: Record<string, string>
  captchaEnabled: boolean
  captchaProvider: string
  captchaSiteKey: string
  adsEnabled: boolean
  adsenseClient: string
  guestPostingEnabled: boolean
}

const DEFAULT_SETTINGS: PublicSettings = {
  siteName: 'PasteShare',
  tagline: 'Share code & files with syntax-highlighted links.',
  logoUrl: '/logo.svg',
  faviconUrl: '/logo.svg',
  metaTitleTemplate: '{title} — PasteShare',
  metaDescriptionTemplate: 'A public paste on PasteShare.',
  metaKeywords: '',
  canonicalUrl: '',
  ogType: 'website',
  ogImage: '',
  twitterCard: 'summary_large_image',
  twitterSite: '',
  socialLinks: {},
  captchaEnabled: false,
  captchaProvider: 'none',
  captchaSiteKey: '',
  adsEnabled: false,
  adsenseClient: '',
  guestPostingEnabled: true,
}

// ---- Module-level store with useSyncExternalStore for instant updates ----

let cachedSettings: PublicSettings | null = null
let fetchPromise: Promise<PublicSettings> | null = null
const listeners = new Set<() => void>()

function notifyListeners() {
  listeners.forEach((fn) => fn())
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

function getSnapshot(): PublicSettings {
  return cachedSettings || DEFAULT_SETTINGS
}

async function fetchSettings(): Promise<PublicSettings> {
  if (cachedSettings) return cachedSettings
  if (fetchPromise) return fetchPromise

  fetchPromise = api.getSettings().then((rows) => {
    const s = rows[0]
    cachedSettings = {
      siteName: (s.siteName as string) || DEFAULT_SETTINGS.siteName,
      tagline: (s.tagline as string) || DEFAULT_SETTINGS.tagline,
      logoUrl: (s.logoUrl as string) || DEFAULT_SETTINGS.logoUrl,
      faviconUrl: (s.faviconUrl as string) || DEFAULT_SETTINGS.faviconUrl,
      metaTitleTemplate: (s.metaTitleTemplate as string) || DEFAULT_SETTINGS.metaTitleTemplate,
      metaDescriptionTemplate: (s.metaDescriptionTemplate as string) || DEFAULT_SETTINGS.metaDescriptionTemplate,
      metaKeywords: (s.metaKeywords as string) || DEFAULT_SETTINGS.metaKeywords,
      canonicalUrl: (s.canonicalUrl as string) || DEFAULT_SETTINGS.canonicalUrl,
      ogType: (s.ogType as string) || DEFAULT_SETTINGS.ogType,
      ogImage: (s.ogImage as string) || DEFAULT_SETTINGS.ogImage,
      twitterCard: (s.twitterCard as string) || DEFAULT_SETTINGS.twitterCard,
      twitterSite: (s.twitterSite as string) || DEFAULT_SETTINGS.twitterSite,
      socialLinks: (s.socialLinks as Record<string, string>) || DEFAULT_SETTINGS.socialLinks,
      captchaEnabled: (s.captchaEnabled as boolean) ?? DEFAULT_SETTINGS.captchaEnabled,
      captchaProvider: (s.captchaProvider as string) || DEFAULT_SETTINGS.captchaProvider,
      captchaSiteKey: (s.captchaSiteKey as string) || DEFAULT_SETTINGS.captchaSiteKey,
      adsEnabled: (s.adsEnabled as boolean) ?? DEFAULT_SETTINGS.adsEnabled,
      adsenseClient: (s.adsenseClient as string) || DEFAULT_SETTINGS.adsenseClient,
      guestPostingEnabled: (s.guestPostingEnabled as boolean) ?? DEFAULT_SETTINGS.guestPostingEnabled,
    }
    notifyListeners()
    return cachedSettings
  }).catch(() => {
    return DEFAULT_SETTINGS
  }).finally(() => {
    fetchPromise = null
  })

  return fetchPromise
}

/** Invalidate the cache (call after admin updates settings) */
export function invalidateSettings() {
  cachedSettings = null
  fetchPromise = null
  // Re-fetch and notify all subscribers
  fetchSettings()
}

export function usePublicSettings(): { settings: PublicSettings; loading: boolean } {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const [loading, setLoading] = useState(!cachedSettings)

  useEffect(() => {
    if (cachedSettings) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false)
      return
    }
    let active = true
    fetchSettings().then(() => {
      if (active) setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  return { settings, loading }
}
