import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProviderWrapper } from "@/components/theme-provider";
import { AnimatedBackground } from "@/components/animated-background";
import { db } from "@/lib/db";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// ---- SEO settings (read from DB, fall back to defaults) -------------------

type SeoSettings = {
  siteName: string;
  tagline: string;
  metaTitleTemplate: string;
  metaDescriptionTemplate: string;
  metaKeywords: string;
  canonicalUrl: string;
  ogType: string;
  ogImage: string;
  twitterCard: string;
  twitterSite: string;
  googleSiteVerification: string;
  googleAnalyticsId: string;
  faviconUrl: string;
};

const SEO_DEFAULTS: SeoSettings = {
  siteName: "PasteShare",
  tagline: "Share code & files with syntax-highlighted links.",
  metaTitleTemplate: "{title} — PasteShare",
  metaDescriptionTemplate: "A public paste on PasteShare.",
  metaKeywords: "pastebin, code share, syntax highlighting",
  canonicalUrl: "",
  ogType: "website",
  ogImage: "",
  twitterCard: "summary_large_image",
  twitterSite: "",
  googleSiteVerification: "",
  googleAnalyticsId: "",
  faviconUrl: "/logo.svg",
};

async function fetchSeoSettings(): Promise<SeoSettings> {
  try {
    const rows = await db.siteSetting.findMany();
    const map: Record<string, unknown> = {};
    for (const r of rows) {
      try {
        map[r.key] = JSON.parse(r.value);
      } catch {
        map[r.key] = r.value;
      }
    }
    const str = (k: keyof SeoSettings): string | undefined => {
      const v = map[k as string];
      return typeof v === "string" ? v : undefined;
    };
    return {
      siteName: str("siteName") ?? SEO_DEFAULTS.siteName,
      tagline: str("tagline") ?? SEO_DEFAULTS.tagline,
      metaTitleTemplate:
        str("metaTitleTemplate") ?? SEO_DEFAULTS.metaTitleTemplate,
      metaDescriptionTemplate:
        str("metaDescriptionTemplate") ?? SEO_DEFAULTS.metaDescriptionTemplate,
      metaKeywords: str("metaKeywords") ?? SEO_DEFAULTS.metaKeywords,
      canonicalUrl: str("canonicalUrl") ?? SEO_DEFAULTS.canonicalUrl,
      ogType: str("ogType") ?? SEO_DEFAULTS.ogType,
      ogImage: str("ogImage") ?? SEO_DEFAULTS.ogImage,
      twitterCard: str("twitterCard") ?? SEO_DEFAULTS.twitterCard,
      twitterSite: str("twitterSite") ?? SEO_DEFAULTS.twitterSite,
      googleSiteVerification:
        str("googleSiteVerification") ?? SEO_DEFAULTS.googleSiteVerification,
      googleAnalyticsId:
        str("googleAnalyticsId") ?? SEO_DEFAULTS.googleAnalyticsId,
      faviconUrl: str("faviconUrl") ?? SEO_DEFAULTS.faviconUrl,
    };
  } catch {
    // DB not yet ready (e.g. first build) — fall back to defaults.
    return SEO_DEFAULTS;
  }
}

const ALLOWED_OG_TYPES = new Set([
  "website",
  "article",
  "book",
  "profile",
  "music.song",
  "music.album",
  "music.playlist",
  "music.radio_station",
  "video.movie",
  "video.tv_show",
  "video.episode",
  "video.other",
]);

const ALLOWED_TWITTER_CARDS = new Set([
  "summary",
  "summary_large_image",
  "player",
  "app",
]);

export async function generateMetadata(): Promise<Metadata> {
  const s = await fetchSeoSettings();

  // Convert `{title} — PasteShare` template → Next.js `%s — PasteShare` form.
  const template = s.metaTitleTemplate.replace("{title}", "%s");
  const defaultTitle = template.replace("%s", s.siteName);
  const description = s.tagline || s.metaDescriptionTemplate;

  const keywords = s.metaKeywords
    ? s.metaKeywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean)
    : undefined;

  const metadataBase = s.canonicalUrl
    ? (() => {
        try {
          return new URL(s.canonicalUrl);
        } catch {
          return undefined;
        }
      })()
    : undefined;

  const verification = s.googleSiteVerification
    ? { google: s.googleSiteVerification }
    : undefined;

  const ogType = ALLOWED_OG_TYPES.has(s.ogType)
    ? (s.ogType as
        | "website"
        | "article"
        | "book"
        | "profile"
        | "music.song"
        | "music.album"
        | "music.playlist"
        | "music.radio_station"
        | "video.movie"
        | "video.tv_show"
        | "video.episode"
        | "video.other")
    : "website";

  const openGraph: Metadata["openGraph"] = {
    title: defaultTitle,
    description,
    siteName: s.siteName,
    type: ogType,
    ...(s.ogImage ? { images: [{ url: s.ogImage }] } : {}),
  };

  const twitterCard = ALLOWED_TWITTER_CARDS.has(s.twitterCard)
    ? (s.twitterCard as "summary" | "summary_large_image" | "player" | "app")
    : "summary_large_image";

  const twitter: Metadata["twitter"] = {
    card: twitterCard,
    title: defaultTitle,
    description,
    ...(s.twitterSite ? { site: s.twitterSite } : {}),
    ...(s.ogImage ? { images: [s.ogImage] } : {}),
  };

  return {
    title: {
      default: defaultTitle,
      template,
    },
    description,
    keywords,
    icons: { icon: s.faviconUrl || "/logo.svg" },
    authors: [{ name: s.siteName }],
    metadataBase,
    verification,
    openGraph,
    twitter,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const s = await fetchSeoSettings();
  const gaId = s.googleAnalyticsId;

  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${gaId}');`}
            </Script>
          </>
        )}
        <ThemeProviderWrapper>
          <AnimatedBackground />
          {children}
          <SonnerToaster position="top-right" richColors closeButton />
        </ThemeProviderWrapper>
      </body>
    </html>
  );
}
