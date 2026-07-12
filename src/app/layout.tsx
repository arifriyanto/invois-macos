import type { Metadata } from "next";
import { Inter, DM_Serif_Display, Sora, Roboto_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import "./palettes.css";
import "@/components/templates/templates.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  // 300 (font-light) is unused in the app — dropped to ship one fewer weight.
  weight: ["400", "500", "600", "700"],
});
const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  variable: "--font-dm-serif",
  weight: "400",
  // Italic is unused — normal only.
  style: "normal",
});
const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  weight: ["500", "600", "700"],
});
// The Mono template's typeface. Self-hosted ON PURPOSE: it used to fall through
// to `ui-monospace`, which on macOS is Apple's SF Mono — and Chromium then
// EMBEDDED SF Mono into every exported PDF, which Apple's licence does not allow
// for documents shared off-Apple. Roboto Mono is Apache-2.0 (free to embed) and
// is the closest match to SF Mono's proportions, so the template barely shifts.
const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "700"],
});

// Minimal metadata — this is the desktop build; the document is never crawled or
// shared as a URL, so the web SEO metadata (OpenGraph, Twitter, robots, keywords,
// canonical, metadataBase) lives only in the web app and was dropped here. Favicon
// conventions (app/icon.svg, app/apple-icon.svg) were dropped too: there is no
// browser tab. The app icon comes from build/icon.icns via electron-builder.
//
// `title` still matters: Chromium stamps the document title into exported PDFs,
// and lib/print.tsx swaps it for the invoice number during an export.
export const metadata: Metadata = {
  title: "Invois",
  description: "Create professional invoices. Your data stays on your computer.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-palette="corporate"
      className={`${inter.variable} ${dmSerif.variable} ${sora.variable} ${robotoMono.variable}`}
    >
      <body>
        {children}
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
