export type Currency = "IDR" | "USD" | "SGD" | "EUR" | "GBP";
export type TemplateId =
  | "minimal"
  | "bold"
  | "elegant"
  | "retro"
  | "aurora"
  | "mono";
export type DiscountType = "pct" | "flat";
export type NumReset = "yearly" | "monthly" | "never";
export type DateFormat = "long" | "dmy-long" | "dmy" | "mdy" | "ymd";

export interface BusinessSettings {
  logo: string | null;
  bizName: string;
  email: string;
  phone: string;
  address: string;
  color: string;
  /** What to show as the invoice header letterhead: the uploaded logo, or the
   * business name as text. "logo" falls back to the name when no logo is set. */
  headerBrand: "logo" | "name";
  currency: Currency;
  invPrefix: string;
  bankName: string;
  bankAccount: string;
  bankOwner: string;
  // Invoice defaults (seed each new invoice)
  paymentTermDays: number;
  defaultTaxEnabled: boolean;
  defaultTaxRate: number;
  defaultNote: string;
  // Numbering
  numPadding: number;
  numReset: NumReset; // legacy — superseded by numFormat; kept for back-compat
  /** Number format template with tokens, e.g. "{PREFIX}-{YYYY}-{SEQ}". */
  numFormat: string;
  // Format
  dateFormat: DateFormat;
  /** Absolute folder path (chosen via the OS folder picker) where PDF/PNG
   * exports are written in the desktop app. Empty = browser download. */
  exportDir: string;
  /** PDF export engine: "raster" = html2canvas→JPEG (current default, silent
   * save + auto-open), "vector" = native print sheet (crisp/selectable text). */
  pdfEngine: "raster" | "vector";
  /** Color theme = a `data-palette` value from palettes.css (applied to <html>). */
  palette: string;
}

export interface LineItem {
  id: string;
  desc: string;
  /** Whole units only. See normalizeQty in lib/money.ts for why. */
  qty: number;
  /** INTEGER minor units (cents; whole rupiah for IDR). 19.99 is stored as 1999.
   *  Never a decimal — see the note at the top of lib/money.ts. */
  priceMinor: number;
}

export interface Client {
  name: string;
  email: string;
  phone: string;
  address: string;
}

export interface InvoiceData {
  number: string;
  date: string;
  due: string;
  note: string;
  client: Client;
  items: LineItem[];
  discountEnabled: boolean;
  /**
   * The one field in the app whose UNIT depends on another field:
   *   discountType "pct"  → a percentage (0–100), and may be fractional (7.5%)
   *   discountType "flat" → INTEGER minor units, exactly like priceMinor
   * It cannot be typed away without splitting it in two, so it is written down
   * instead. Anything reading it must branch on discountType first — see
   * calcTotals, which is the only place that should need to.
   *
   * The name is also load-bearing. It used to be `discount`, and the format-2→3
   * migration had no way to tell an already-scaled amount from an unscaled one —
   * so running it twice turned a $50 discount into $5,000. `priceMinor` did not
   * have that problem, because the rename WAS the marker. This field now works
   * the same way: `discount` present = old, `discountValue` present = migrated.
   */
  discountValue: number;
  discountType: DiscountType;
  taxEnabled: boolean;
  /** A percentage (0–100). May be fractional — 8.5% is a real tax rate. */
  taxRate: number;
}

/** All four are INTEGER minor units (see lib/money.ts). */
export interface Totals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

export type Lang = "id" | "en";
