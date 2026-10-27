'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'

/**
 * Public ad shape returned by `GET /api/ads?slot=…`.
 */
type PublicAd = {
  id: string
  name: string
  slot: string
  adType: 'html' | 'image' | 'adsense' | 'custom'
  content: string
  imageUrl: string | null
  linkUrl: string | null
}

/**
 * AdSlot — fetches and renders ads for a given slot.
 *
 * - On mount, fetches `api.listAds(slot)` (public, increments impressions).
 * - Renders each ad by `adType` (html / image / adsense / custom).
 * - Wraps each ad in a `.surface rounded-xl p-4` card with a "Sponsored" label.
 * - On click, fire-and-forget `api.adClick(ad.id)`.
 * - If no ads or fetch fails → renders `null` (no skeletons, no error UI).
 */
export function AdSlot({
  slot,
  className,
}: {
  slot: string
  className?: string
}) {
  const [ads, setAds] = useState<PublicAd[]>([])

  useEffect(() => {
    let alive = true
    api
      .listAds(slot)
      .then((rows) => {
        if (alive) setAds(rows as PublicAd[])
      })
      .catch(() => {
        /* Ads are best-effort — never surface errors to the user. */
      })
    return () => {
      alive = false
    }
  }, [slot])

  if (ads.length === 0) return null

  return (
    <div className={className ?? 'space-y-3'}>
      {ads.map((ad) => (
        <AdCard key={ad.id} ad={ad} />
      ))}
    </div>
  )
}

function AdCard({ ad }: { ad: PublicAd }) {
  function handleClick() {
    // Fire-and-forget click increment. Only the link itself records a click
    // (the wrapper used to as well, so every click counted twice).
    api.adClick(ad.id).catch(() => {})
  }

  return (
    <div className="surface overflow-hidden rounded-xl p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          Sponsored
        </span>
        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          ad
        </span>
      </div>

      <AdContent ad={ad} onClick={handleClick} />
    </div>
  )
}

function AdContent({
  ad,
  onClick,
}: {
  ad: PublicAd
  onClick: () => void
}) {
  // image — anchor-wrapped image
  if (ad.adType === 'image') {
    if (!ad.imageUrl) return null
    const img = (
      <img
        src={ad.imageUrl}
        alt={ad.name}
        className="block max-h-[280px] w-full rounded-md object-cover"
        loading="lazy"
      />
    )
    if (ad.linkUrl) {
      return (
        <a
          href={ad.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClick}
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-md"
        >
          {img}
        </a>
      )
    }
    return img
  }

  // adsense — render the AdSense markup from content (ins + script).
  // The markup is supplied by an admin, so we render it verbatim.
  if (ad.adType === 'adsense') {
    if (!ad.content) return null
    if (ad.linkUrl) {
      return (
        <a
          href={ad.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClick}
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-md"
          dangerouslySetInnerHTML={{ __html: ad.content }}
        />
      )
    }
    return (
      <div
        className="min-h-[90px]"
        dangerouslySetInnerHTML={{ __html: ad.content }}
      />
    )
  }

  // html & custom — render the supplied HTML markup (admin-authored).
  // Sandbox: scripts are stripped server-side; only markup is rendered here.
  if (ad.adType === 'html' || ad.adType === 'custom') {
    if (!ad.content) return null
    if (ad.linkUrl) {
      return (
        <a
          href={ad.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClick}
          className="block cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background [&_a]:pointer-events-none"
          dangerouslySetInnerHTML={{ __html: ad.content }}
        />
      )
    }
    return (
      <div
        className="ad-html text-sm"
        dangerouslySetInnerHTML={{ __html: ad.content }}
      />
    )
  }

  return null
}
