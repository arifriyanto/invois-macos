import type { Currency, DateFormat, InvoiceData, Lang, TemplateId, Totals } from "./types";

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  IDR: "Rp", USD: "$", SGD: "S$", EUR: "€", GBP: "£",
};
export const CURRENCY_LOCALE: Record<Currency, string> = {
  IDR: "id-ID", USD: "en-US", SGD: "en-SG", EUR: "de-DE", GBP: "en-GB",
};

export const CURRENCY_OPTIONS: { value: Currency; label: string }[] = [
  { value: "IDR", label: "IDR - Rupiah" },
  { value: "USD", label: "USD - Dollar" },
  { value: "SGD", label: "SGD - Singapore Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "GBP", label: "GBP - Pound Sterling" },
];

/**
 * Phone placeholders — a real prefix, an INCOMPLETE tail.
 *
 * Two mistakes to avoid, and this app made both:
 *
 * 1. A realistic fake number can belong to a real person, and a placeholder is
 *    shown on thousands of screens — a fine way to get a stranger phoned. So the
 *    last digits are left as "x". The prefix is real (a carrier block like 812, an
 *    area code like 415), which is the part that actually teaches the format; the
 *    number as a whole cannot be dialled because it does not exist.
 *    GBP goes further: 7700 900xxx is Ofcom's range reserved for fiction, so even
 *    a completed guess belongs to nobody.
 *
 * 2. It must follow the user's COUNTRY, not the UI language. The English
 *    dictionary used to offer a US example — so an Indonesian freelancer who
 *    switched the interface to English was shown a New York phone shape. Language
 *    says nothing about where someone lives. Currency, chosen at onboarding, is
 *    the closest signal we have, so we key off that.
 */
export const PHONE_PLACEHOLDER: Record<Currency, string> = {
  IDR: "+62 812 3456 xxxx",
  USD: "+1 (415) 555-xxxx",
  SGD: "+65 8123 xxxx",
  EUR: "+49 30 1234 xxxx",
  GBP: "+44 7700 900xxx", // Ofcom's reserved fiction range
};

// Map an ISO region to one of the currencies we support. Anything not listed
// falls back to USD (see detectDefaultCurrency).
const REGION_CURRENCY: Record<string, Currency> = {
  ID: "IDR", SG: "SGD", GB: "GBP",
  // Eurozone
  AT: "EUR", BE: "EUR", CY: "EUR", EE: "EUR", FI: "EUR", FR: "EUR", DE: "EUR",
  GR: "EUR", IE: "EUR", IT: "EUR", LV: "EUR", LT: "EUR", LU: "EUR", MT: "EUR",
  NL: "EUR", PT: "EUR", SK: "EUR", SI: "EUR", ES: "EUR", HR: "EUR",
};

// Timezone → currency. Preferred over locale because the OS timezone reflects
// the user's actual location, whereas the UI language can be e.g. "en-GB"
// (British English) for someone who isn't in the UK.
const TZ_CURRENCY: Record<string, Currency> = {
  "Asia/Jakarta": "IDR", "Asia/Pontianak": "IDR", "Asia/Makassar": "IDR", "Asia/Jayapura": "IDR",
  "Asia/Singapore": "SGD",
  "Europe/London": "GBP",
  // Eurozone hubs
  "Europe/Paris": "EUR", "Europe/Berlin": "EUR", "Europe/Madrid": "EUR", "Europe/Rome": "EUR",
  "Europe/Amsterdam": "EUR", "Europe/Brussels": "EUR", "Europe/Vienna": "EUR", "Europe/Lisbon": "EUR",
  "Europe/Dublin": "EUR", "Europe/Athens": "EUR", "Europe/Helsinki": "EUR", "Europe/Bratislava": "EUR",
  "Europe/Ljubljana": "EUR", "Europe/Zagreb": "EUR", "Europe/Vilnius": "EUR", "Europe/Riga": "EUR",
  "Europe/Tallinn": "EUR", "Europe/Luxembourg": "EUR", "Europe/Malta": "EUR", "Europe/Nicosia": "EUR",
};

/** Best-effort default currency, restricted to the currencies the app supports.
 *  Tries the OS timezone first (reflects location), then the locale region, then
 *  falls back to USD. Client-only (reads Intl/navigator). */
export function detectDefaultCurrency(): Currency {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TZ_CURRENCY[tz]) return TZ_CURRENCY[tz];
  } catch {
    /* fall through to locale */
  }
  try {
    const tag = typeof navigator !== "undefined" ? navigator.language : "";
    let region = "";
    try {
      region = new Intl.Locale(tag).maximize().region ?? "";
    } catch {
      region = tag.split("-")[1] ?? "";
    }
    return REGION_CURRENCY[region.toUpperCase()] ?? "USD";
  } catch {
    return "USD";
  }
}

// Free tier ships a single template (Minimal). Everything else is Pro — this is
// the primary Pro lever. See invois-app/docs/free-vs-pro-plan.md.
export const TEMPLATES: { id: TemplateId; label: string }[] = [
  { id: "minimal", label: "Minimal" },
];

// Premium (Pro) templates: fully previewable for free, but selecting one prompts
// the upgrade popup for free users (see TemplateGrid/preview). They render like
// any other template (real designs); the gate is on selection, not rendering.
export const PREMIUM_TEMPLATES: { id: TemplateId; label: string }[] = [
  { id: "bold", label: "Bold" },
  { id: "elegant", label: "Elegant" },
  { id: "retro", label: "Retro" },
  { id: "aurora", label: "Aurora" },
  { id: "mono", label: "Mono" },
];

const PREMIUM_IDS = new Set<TemplateId>(PREMIUM_TEMPLATES.map((t) => t.id));

export function isPremiumTemplate(id: TemplateId): boolean {
  return PREMIUM_IDS.has(id);
}

// The template actually RENDERED and EXPORTED. Free users always fall back to
// Minimal, so forcing a premium template through a side door (e.g. editing the
// vault JSON) still can't produce a premium preview or export. The picker UI
// already blocks selecting one; this is the enforcement at render/export time.
export function resolveTemplate(id: TemplateId, isPro: boolean): TemplateId {
  return !isPro && isPremiumTemplate(id) ? "minimal" : id;
}

export function formatCurrency(n: number, currency: Currency): string {
  const sym = CURRENCY_SYMBOLS[currency];
  const locale = CURRENCY_LOCALE[currency];
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: currency === "IDR" ? 0 : 2,
  }).format(Number.isFinite(n) ? n : 0);
  return currency === "IDR" ? `${sym} ${formatted}` : `${sym}${formatted}`;
}

// Month names are resolved manually rather than via toLocaleDateString.
//
// Originally this was forced on us: the Tauri build ran on WKWebView, whose
// JavaScriptCore ships incomplete Intl date patterns and produced malformed
// output like "January, 1 2026". Chromium's Intl is fine, so the workaround is
// no longer strictly needed — but we keep it deliberately: an invoice date must
// render identically on every engine, and hand-building the string is the only
// way to guarantee that. Do not "simplify" this back to toLocaleDateString.
const MONTH_NAMES: Record<Lang, string[]> = {
  id: [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ],
  en: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ],
};

export function formatDate(str: string, lang: Lang = "id", fmt: DateFormat = "long"): string {
  if (!str) return "—";
  const d = new Date(str + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "—";
  if (fmt === "long" || fmt === "dmy-long") {
    const day = d.getDate();
    const month = MONTH_NAMES[lang][d.getMonth()];
    const year = d.getFullYear();
    // dmy-long: always day-first  →  "1 Januari 2026" / "1 January 2026"
    if (fmt === "dmy-long") return `${day} ${month} ${year}`;
    // long: language-native  →  id "1 Januari 2026" · en "January 1, 2026"
    return lang === "en" ? `${month} ${day}, ${year}` : `${day} ${month} ${year}`;
  }
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  if (fmt === "dmy") return `${dd}/${mm}/${yyyy}`;
  if (fmt === "mdy") return `${mm}/${dd}/${yyyy}`;
  return `${yyyy}-${mm}-${dd}`;
}

export function calcTotals(inv: InvoiceData): Totals {
  const subtotal = inv.items.reduce(
    (s, i) => s + Math.max(0, i.qty) * Math.max(0, i.price),
    0
  );
  let discount = 0;
  if (inv.discountEnabled) {
    const dv = Math.max(0, inv.discount || 0);
    discount = inv.discountType === "pct" ? (subtotal * dv) / 100 : dv;
  }
  // Clamp: discount can never exceed subtotal (no negative totals)
  discount = Math.min(discount, subtotal);

  let tax = 0;
  if (inv.taxEnabled) {
    const tr = Math.max(0, inv.taxRate || 0);
    tax = ((subtotal - discount) * tr) / 100;
  }
  return { subtotal, discount, tax, total: subtotal - discount + tax };
}
