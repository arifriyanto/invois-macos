import type { Metadata } from "next";
import { Inter, DM_Serif_Display, Sora } from "next/font/google";
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
    <html lang="en" data-palette="corporate" className={`${inter.variable} ${dmSerif.variable} ${sora.variable}`}>
      <body>
        {children}
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
