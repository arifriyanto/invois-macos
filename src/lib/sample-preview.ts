// A fully-populated invoice view for the template-picker thumbnails. The picker
// previously mirrored the live (often empty) invoice, so the designs looked
// blank. This builds a complete sample document — filled client, 5 line items,
// bank details, a generated monogram logo — while still inheriting the user's
// accent color, currency, date format and brand mode so each thumbnail reflects
// their real styling choices.
import type { BusinessSettings, InvoiceData } from "./types";
import { tFor } from "./i18n";
import { buildView, type InvoiceView } from "./view";

function sampleLogo(color: string, initial: string): string {
  const c = color || "#1d4ed8";
  const ch = (initial.trim()[0] || "N").toUpperCase();
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'>` +
    `<rect width='96' height='96' rx='20' fill='${c}'/>` +
    `<text x='50%' y='53%' font-family='Sora, Arial, sans-serif' font-size='50' font-weight='700' ` +
    `fill='#ffffff' text-anchor='middle' dominant-baseline='central'>${ch}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Thumbnail content is always English (it's just a preview, not user-facing
// copy), so it doesn't need translating with the app language.
const SAMPLE_INVOICE: InvoiceData = {
  number: "INV-2026-014",
  date: "2026-07-01",
  due: "2026-07-15",
  note: "Thank you for your business.",
  client: {
    name: "Bright Creative Co.",
    email: "hello@brightcreative.co",
    phone: "+1 (415) 555-0142",
    address: "24 Market Street, San Francisco",
  },
  items: [
    { id: "s1", desc: "Logo & visual identity design", qty: 1, price: 2_500_000 },
    { id: "s2", desc: "Website design (5 pages)", qty: 1, price: 7_500_000 },
    { id: "s3", desc: "Content copywriting", qty: 3, price: 750_000 },
    { id: "s4", desc: "Brand consulting session", qty: 2, price: 500_000 },
    { id: "s5", desc: "Revisions & finalization", qty: 1, price: 1_000_000 },
  ],
  discountEnabled: true,
  discount: 5,
  discountType: "pct",
  taxEnabled: true,
  taxRate: 11,
};

export function buildSampleView(bk: BusinessSettings): InvoiceView {
  const sampleBk: BusinessSettings = {
    ...bk,
    bizName: bk.bizName || "Northwind Studio",
    email: bk.email || "hello@northwind.studio",
    phone: bk.phone || "+1 (212) 555-0198",
    address: bk.address || "18 Hudson Yards, New York",
    bankName: bk.bankName || "First National Bank",
    bankAccount: bk.bankAccount || "1234567890",
    bankOwner: bk.bankOwner || bk.bizName || "Northwind Studio",
    logo: bk.logo ?? sampleLogo(bk.color, bk.bizName || "Northwind Studio"),
  };
  // Always English + English date formatting for the thumbnail.
  return buildView(sampleBk, SAMPLE_INVOICE, tFor("en"), "en");
}
