import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProviderWrapper } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PasteShare — Share code & files with syntax-highlighted links",
  description:
    "PasteShare is a Pastebin-style platform for sharing text/code snippets with Monaco syntax highlighting and file uploads. Supports expiry, password protection, burn-after-read, and privacy controls.",
  keywords: [
    "pastebin",
    "code share",
    "syntax highlighting",
    "Monaco editor",
    "file sharing",
    "PasteShare",
  ],
  authors: [{ name: "PasteShare" }],
  icons: { icon: "/logo.svg" },
  openGraph: {
    title: "PasteShare",
    description: "Share code & files with syntax-highlighted links.",
    siteName: "PasteShare",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PasteShare",
    description: "Share code & files with syntax-highlighted links.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProviderWrapper>
          {children}
          <SonnerToaster position="top-right" richColors closeButton />
        </ThemeProviderWrapper>
      </body>
    </html>
  );
}
